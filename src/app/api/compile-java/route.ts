// src/app/api/compile-java/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';


async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proj-compile-'));

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
    
    if (projectFiles.length > 0 && projectFiles[0].type === 'directory') {
        for (const file of projectFiles[0].children) {
            await writeFile(file, tempDir);
        }
    } else { 
        for (const file of projectFiles) {
            await writeFile(file, tempDir);
        }
    }
    return tempDir;
}

function executeCommand(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve) => {
        const process = spawn(command, args, { cwd });
        let stdout = '';
        let stderr = '';
        process.stdout.on('data', (data) => stdout += data.toString());
        process.stderr.on('data', (data) => stderr += data.toString());
        process.on('close', (code) => resolve({ stdout, stderr, code }));
        process.on('error', (err) => resolve({ stdout: '', stderr: `Failed to start process: ${err.message}`, code: -1 }));
    });
}


const findJavaFilesRecursive = async (dir: string): Promise<string[]> => {
    let results: string[] = [];
    try {
        await fs.access(dir);
        const list = await fs.readdir(dir, { withFileTypes: true });
        for (const file of list) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                results = results.concat(await findJavaFilesRecursive(fullPath));
            } else if (file.name.endsWith('.java')) {
                results.push(fullPath);
            }
        }
    } catch (e) {
        console.warn(`Could not read directory ${dir}, skipping. Error: ${e}`);
    }
    return results;
};


const compileJava = async (config: any, tempDir: string) => {
    const userSourcePath = config.sourcePaths?.[0] || '.';
    const compilationCwd = path.join(tempDir, userSourcePath);
    
    const buildPath = path.join(tempDir, 'build');
    await fs.mkdir(buildPath, { recursive: true });

    const sourceFiles = await findJavaFilesRecursive(compilationCwd);
    
    if (sourceFiles.length === 0) {
        return { stdout: '', stderr: `No Java source files found in: ${userSourcePath}.`, code: 0 };
    }
    
    return executeCommand('javac', ['-d', buildPath, ...sourceFiles], compilationCwd);
};

export async function POST(req: NextRequest) {
    let tempDir = '';
    try {
        const { projectFiles, config } = await req.json();
        tempDir = await createProjectInTempDir(projectFiles);

        const result = await compileJava(config, tempDir);

        if (result.code !== 0) {
            return NextResponse.json({ success: false, error: result.stderr || result.stdout });
        }
        
        return NextResponse.json({ success: true, data: { message: "Compilation successful", details: result.stdout } });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    } finally {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(err => console.error(`Failed to remove temp dir ${tempDir}`, err));
        }
    }
}
