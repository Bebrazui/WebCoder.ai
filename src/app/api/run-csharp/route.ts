
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'csharp-project-'));

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

async function compileCsharpProject(projectPath: string, projectName: string): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    const buildPath = path.join(projectPath, 'build');

    const compileProcess = spawn('dotnet', [
        'publish',
        '-c', 'Release',
        '-o', buildPath
    ], { cwd: path.join(projectPath, projectName) });

    return new Promise((resolve) => {
        let compileError = '';
        compileProcess.stderr.on('data', (data) => {
            compileError += data.toString();
        });
        compileProcess.stdout.on('data', (data) => {
            // Can be noisy, useful for debugging
            // console.log(data.toString());
        });
        compileProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, outputPath: path.join(buildPath, projectName) });
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
    const { projectFiles, entryPoint, inputData } = await req.json();

    if (!projectFiles || !entryPoint) {
        return NextResponse.json({ success: false, error: 'Project files and entry point are required.' }, { status: 400 });
    }

    const tempProjectPath = await createProjectInTempDir(projectFiles);

    try {
        const compileResult = await compileCsharpProject(tempProjectPath, entryPoint);
        if (!compileResult.success) {
            return NextResponse.json({ success: false, error: `Compilation failed: ${compileResult.error}` }, { status: 500 });
        }
        
        const csharpAppPath = compileResult.outputPath!;

        const runResult = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
            const csharpProcess = spawn(csharpAppPath, [JSON.stringify(inputData)]);

            let csharpOutput = '';
            let csharpError = '';

            csharpProcess.stdout.on('data', (data) => { csharpOutput += data.toString(); });
            csharpProcess.stderr.on('data', (data) => { csharpError += data.toString(); });

            csharpProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const resultData = JSON.parse(csharpOutput);
                        resolve({ success: true, data: resultData });
                    } catch (e) {
                        resolve({ success: false, error: `Error parsing C# output: ${csharpOutput}` });
                    }
                } else {
                    resolve({ success: false, error: csharpError || 'C# process exited with non-zero code.' });
                }
            });

            csharpProcess.on('error', (err) => {
                resolve({ success: false, error: `Failed to start C# process: ${err.message}` });
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
