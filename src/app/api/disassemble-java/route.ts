
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

    // Since projectFiles is [vfsRoot], we iterate its children into the tempDir
    if (projectFiles.length > 0 && projectFiles[0].type === 'directory') {
        for (const file of projectFiles[0].children) {
            await writeFile(file, tempDir);
        }
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
        const cleanClassFilePath = classFilePath.startsWith('/') ? classFilePath.substring(1) : classFilePath;
        
        // Heuristic to find the classpath root.
        let classpathRoot = tempDir;
        let relativeClassPath = cleanClassFilePath;
        
        const pathParts = path.dirname(cleanClassFilePath).split(path.sep);
        let foundRoot = false;
        // Iterate backwards to find a conventional build directory name
        for (let i = pathParts.length - 1; i >= 0; i--) {
            const potentialRootName = pathParts[i];
            if (['build', 'out', 'target', 'classes', 'bin'].includes(potentialRootName.toLowerCase())) {
                const rootPath = path.join(tempDir, ...pathParts.slice(0, i + 1));
                const classFileSubPath = path.join(...pathParts.slice(i + 1), path.basename(cleanClassFilePath));
                
                classpathRoot = rootPath;
                relativeClassPath = classFileSubPath;
                foundRoot = true;
                break;
            }
        }
        
        if (!foundRoot && cleanClassFilePath.includes('/')) {
            // If no build dir found, assume the project root is the classpath.
             classpathRoot = tempDir;
             relativeClassPath = cleanClassFilePath;
        }


        const fullClassPathOnDisk = path.join(tempDir, cleanClassFilePath);
        
        // We need to provide the fully qualified class name, not the file path.
        // e.g., for /build/com/example/MyClass.class, it's com.example.MyClass
        const qualifiedClassName = relativeClassPath.replace(/\.class$/, '').replace(new RegExp(`\\${path.sep}`, 'g'), '.');
        
        // Check if the file actually exists
        try {
            await fs.access(fullClassPathOnDisk);
        } catch (e) {
             throw new Error(`The specified class file does not exist in the temporary directory. Expected at: ${fullClassPathOnDisk}`);
        }
        
        const result = await executeCommand('javap', ['-c', qualifiedClassName], classpathRoot);

        if (result.code !== 0) {
            // Provide a more helpful error if classpath might be the issue
            if (result.stderr.includes('class not found')) {
                throw new Error(`javap could not find class '${qualifiedClassName}'. This often indicates a classpath issue. Used classpath: '${classpathRoot}'.\n\nFull error:\n${result.stderr}`);
            }
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
