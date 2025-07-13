// src/app/api/disassemble-java/route.ts
'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { VFSNode } from '@/lib/vfs';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { dataURIToArrayBuffer } from '@/lib/utils';

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proj-disassemble-'));

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


function executeCommand(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve) => {
        console.log(`Executing for disassembly: \`${command} ${args.join(' ')}\` in ${cwd}`);
        const process = spawn(command, args, { cwd });
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => { stdout += data.toString(); });
        process.stderr.on('data', (data) => { stderr += data.toString(); });
        
        process.on('close', (code) => {
            console.log(`Disassembly command finished with code ${code}.`);
            console.log(`Stdout: ${stdout}`);
            console.error(`Stderr: ${stderr}`);
            resolve({ stdout, stderr, code });
        });

        process.on('error', (err) => {
            const errorMsg = `Failed to start process '${command}': ${err.message}`;
            console.error(errorMsg);
            resolve({ stdout: '', stderr: errorMsg, code: -1 });
        });
    });
}


export async function POST(req: NextRequest) {
    let tempDir = '';
    try {
        const { projectFiles, classFilePath } = await req.json() as { projectFiles: VFSNode[], classFilePath: string };

        if (!projectFiles || !classFilePath) {
            return NextResponse.json({ success: false, error: 'Project files and a class file path are required.' }, { status: 400 });
        }
        
        tempDir = await createProjectInTempDir(projectFiles);

        // Find the most likely classpath root by looking for common build directories
        const possibleRoots = ['/build/', '/out/', '/target/'];
        let classpathRoot = tempDir;
        let relativeClassPath = classFilePath.startsWith('/') ? classFilePath.substring(1) : classFilePath;
        
        for (const root of possibleRoots) {
            const rootIndex = classFilePath.indexOf(root);
            if (rootIndex !== -1) {
                classpathRoot = path.join(tempDir, classFilePath.substring(0, rootIndex + root.length));
                relativeClassPath = classFilePath.substring(rootIndex + root.length);
                break;
            }
        }

        const fullClassPathOnDisk = path.join(tempDir, classFilePath.startsWith('/') ? classFilePath.substring(1) : classFilePath);
        
        // We need to provide the fully qualified class name, not the file path.
        // e.g., for /build/com/example/MyClass.class, it's com.example.MyClass
        const qualifiedClassName = relativeClassPath.replace(/\.class$/, '').replace(/\//g, '.');

        // Check if the file actually exists
        try {
            await fs.access(fullClassPathOnDisk);
        } catch (e) {
             throw new Error(`The specified class file does not exist in the build directory: ${classFilePath}`);
        }
        
        const result = await executeCommand('javap', ['-c', qualifiedClassName], classpathRoot);

        if (result.code !== 0) {
            throw new Error(result.stderr || `javap failed with code ${result.code}`);
        }

        return NextResponse.json({ success: true, disassembledCode: result.stdout });

    } catch (error: any) {
        console.error(`Error in /api/disassemble-java:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    } finally {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(err => console.error(`Failed to remove temp dir ${tempDir}`, err));
        }
    }
}
