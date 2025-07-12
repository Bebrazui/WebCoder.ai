
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'go-project-'));

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

async function compileGoProject(projectPath: string): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    const outputPath = path.join(projectPath, 'my_go_app');
    
    const compileProcess = spawn('go', [
        'build',
        '-o', outputPath,
        '.' // Compile the whole package in the current directory
    ], { cwd: projectPath }); // Set current working directory for the compiler

    return new Promise((resolve) => {
        let compileError = '';
        compileProcess.stderr.on('data', (data) => {
            compileError += data.toString();
        });
        compileProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, outputPath });
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
        const compileResult = await compileGoProject(tempProjectPath);
        if (!compileResult.success) {
            return NextResponse.json({ success: false, error: `Compilation failed: ${compileResult.error}` }, { status: 500 });
        }

        const goAppPath = compileResult.outputPath!;

        const runResult = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
            const goProcess = spawn(goAppPath, [JSON.stringify(inputData)]);

            let goOutput = '';
            let goError = '';

            goProcess.stdout.on('data', (data) => { goOutput += data.toString(); });
            goProcess.stderr.on('data', (data) => { goError += data.toString(); });

            goProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const resultData = JSON.parse(goOutput);
                        resolve({ success: true, data: resultData });
                    } catch (e) {
                        resolve({ success: false, error: `Error parsing Go output: ${goOutput}` });
                    }
                } else {
                    resolve({ success: false, error: goError || 'Go process exited with non-zero code.' });
                }
            });

            goProcess.on('error', (err) => {
                resolve({ success: false, error: `Failed to start Go process: ${err.message}` });
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
