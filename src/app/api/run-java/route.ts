
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';


async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'java-project-'));

    const writeFile = async (node: VFSNode, currentPath: string) => {
        const fullPath = path.join(currentPath, node.name);
        if (node.type === 'directory') {
            await fs.mkdir(fullPath, { recursive: true });
            for (const child of node.children) {
                await writeFile(child, fullPath);
            }
        } else {
            const content = node.content.startsWith('data:')
                ? Buffer.from(dataURIToArrayBuffer(node.content))
                : node.content;
            await fs.writeFile(fullPath, content);
        }
    };

    for (const file of projectFiles) {
        await writeFile(file, tempDir);
    }
    
    return tempDir;
}

async function compileJavaProject(projectPath: string): Promise<{ success: boolean; error?: string }> {
    const sourcesPath = path.join(projectPath, 'src');
    const buildPath = path.join(projectPath, 'build');
    const libPath = path.join(projectPath, 'lib');
    await fs.mkdir(buildPath, { recursive: true });

    // Find all .java files
    const findJavaFiles = async (dir: string): Promise<string[]> => {
        let javaFiles: string[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                javaFiles = javaFiles.concat(await findJavaFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.java')) {
                javaFiles.push(fullPath);
            }
        }
        return javaFiles;
    }
    const javaFiles = await findJavaFiles(sourcesPath);
    if (javaFiles.length === 0) {
        return { success: false, error: "No .java files found in /src directory." };
    }

    const classPathSeparator = process.platform === 'win32' ? ';' : ':';
    const classPath = `${buildPath}${classPathSeparator}${libPath}/*`;

    const compileProcess = spawn('javac', [
        '-d', buildPath,
        '-cp', classPath,
        ...javaFiles
    ]);

    return new Promise((resolve) => {
        let compileError = '';
        compileProcess.stderr.on('data', (data) => {
            compileError += data.toString();
        });
        compileProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true });
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
        const compileResult = await compileJavaProject(tempProjectPath);
        if (!compileResult.success) {
            await fs.rm(tempProjectPath, { recursive: true, force: true });
            return NextResponse.json({ success: false, error: `Compilation failed: ${compileResult.error}` }, { status: 500 });
        }

        const runResult = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
            const buildPath = path.join(tempProjectPath, 'build');
            const libPath = path.join(tempProjectPath, 'lib');
            const classPathSeparator = process.platform === 'win32' ? ';' : ':';
            const classPath = `${buildPath}${classPathSeparator}${libPath}/*`;
            
            const javaProcess = spawn('java', [
                '-cp', classPath,
                entryPoint, // e.g., 'MyJavaApp'
                JSON.stringify(inputData),
            ]);

            let javaOutput = '';
            let javaError = '';

            javaProcess.stdout.on('data', (data) => { javaOutput += data.toString(); });
            javaProcess.stderr.on('data', (data) => { javaError += data.toString(); });

            javaProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const resultData = JSON.parse(javaOutput);
                        resolve({ success: true, data: resultData });
                    } catch (e) {
                        resolve({ success: false, error: `Error parsing Java output: ${javaOutput}` });
                    }
                } else {
                    resolve({ success: false, error: javaError || 'Java process exited with non-zero code.' });
                }
            });

            javaProcess.on('error', (err) => {
                resolve({ success: false, error: `Failed to start Java process: ${err.message}` });
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
