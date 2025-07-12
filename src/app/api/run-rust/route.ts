
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-project-'));

    const writeFile = async (node: VFSNode, currentPath: string) => {
        const fullPath = path.join(currentPath, node.name);
        if (node.type === 'directory') {
            await fs.mkdir(fullPath, { recursive: true });
            for (const child of node.children) {
                await writeFile(child, fullPath);
            }
        } else {
            await fs.writeFile(fullPath, node.content);
        }
    };

    for (const file of projectFiles) {
        await writeFile(file, tempDir);
    }
    
    return tempDir;
}

async function compileRustProject(projectPath: string): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    
    const compileProcess = spawn('cargo', [
        'build',
        '--release'
    ], { cwd: projectPath });

    return new Promise((resolve) => {
        let compileError = '';
        compileProcess.stderr.on('data', (data) => {
            compileError += data.toString();
        });
        compileProcess.on('close', async (code) => {
            if (code === 0) {
                 try {
                    const manifest = await fs.readFile(path.join(projectPath, 'Cargo.toml'), 'utf-8');
                    const match = /name\s*=\s*"([^"]+)"/.exec(manifest);
                    if (!match) {
                       resolve({ success: false, error: "Could not find package name in Cargo.toml" });
                       return;
                    }
                    const packageName = match[1];
                    const outputPath = path.join(projectPath, 'target', 'release', packageName);
                    resolve({ success: true, outputPath });
                } catch (e) {
                    resolve({ success: false, error: "Could not read Cargo.toml to determine executable name."});
                }
            } else {
                resolve({ success: false, error: compileError });
            }
        });
        compileProcess.on('error', (err) => {
            resolve({ success: false, error: `Compiler execution failed: ${err.message}` });
        });
    });
}

export async function POST(req: NextRequest) {
    const { projectFiles, inputData } = await req.json();

    if (!projectFiles) {
        return NextResponse.json({ success: false, error: 'Project files are required.' }, { status: 400 });
    }

    const tempProjectPath = await createProjectInTempDir(projectFiles);

    try {
        const compileResult = await compileRustProject(tempProjectPath);
        if (!compileResult.success) {
            return NextResponse.json({ success: false, error: `Compilation failed: ${compileResult.error}` }, { status: 500 });
        }
        
        const rustAppPath = compileResult.outputPath!;

        const runResult = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
            const rustProcess = spawn(rustAppPath, [JSON.stringify(inputData)]);

            let rustOutput = '';
            let rustError = '';

            rustProcess.stdout.on('data', (data) => { rustOutput += data.toString(); });
            rustProcess.stderr.on('data', (data) => { rustError += data.toString(); });

            rustProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const resultData = JSON.parse(rustOutput);
                        resolve({ success: true, data: resultData });
                    } catch (e) {
                        resolve({ success: false, error: `Error parsing Rust output: ${rustOutput}` });
                    }
                } else {
                    resolve({ success: false, error: rustError || 'Rust process exited with non-zero code.' });
                }
            });

            rustProcess.on('error', (err) => {
                resolve({ success: false, error: `Failed to start Rust process: ${err.message}` });
            });
        });

        if (runResult.success) {
            return NextResponse.json({ success: true, data: runResult.data });
        } else {
            return NextResponse.json({ success: false, error: runResult.error }, { status: 500 });
        }
    } finally {
        await fs.rm(tempProjectPath, { recursive: true, force: true });
    }
}
