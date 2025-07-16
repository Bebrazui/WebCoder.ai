// src/app/api/disassemble-java/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { type VFSNode, type VFSDirectory } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';

async function createProjectInTempDir(projectRoot: VFSNode): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proj-disassemble-'));

    const writeFileRecursive = async (node: VFSNode, currentPath: string) => {
        const fullPath = path.join(currentPath, node.name);
        if (node.type === 'directory') {
            await fs.mkdir(fullPath, { recursive: true });
            for (const child of node.children) {
                await writeFileRecursive(child, fullPath);
            }
        } else {
            const content = node.content.startsWith('data:')
                ? Buffer.from(dataURIToArrayBuffer(node.content))
                : node.content;
            await fs.writeFile(fullPath, content);
        }
    };
    
    // We want to write the *children* of the root node into our temp directory.
    if (projectRoot.type === 'directory') {
        for (const child of projectRoot.children) {
            await writeFileRecursive(child, tempDir);
        }
    }
    
    return tempDir;
}

const findClassFilesRecursive = async (dir: string): Promise<string[]> => {
    let results: string[] = [];
    try {
        await fs.access(dir); // Check if directory exists
        const list = await fs.readdir(dir, { withFileTypes: true });
        for (const file of list) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                results = results.concat(await findClassFilesRecursive(fullPath));
            } else if (file.name.endsWith('.class')) {
                results.push(fullPath);
            }
        }
    } catch (e) {
        // Ignore errors for non-existent dirs, like if 'build' doesn't exist.
    }
    return results;
};


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

export async function POST(req: NextRequest) {
    let tempDir = '';
    try {
        const { projectRoot, filePath } = await req.json() as { projectRoot: VFSDirectory, filePath: string };
        tempDir = await createProjectInTempDir(projectRoot);
        
        const buildDir = path.join(tempDir, 'build');
        
        // --- Disassembly Step ---
        const targetClassFileName = path.basename(filePath); // e.g., "Backyard.class"

        // Find the corresponding .class file path in the build directory.
        const allClassFiles = await findClassFilesRecursive(buildDir);
        const targetClassFile = allClassFiles.find(f => path.basename(f) === targetClassFileName);

        if (!targetClassFile) {
            throw new Error(`Could not find compiled class for ${targetClassFileName} in the project build output.`);
        }
        
        // Correctly determine the fully qualified class name for javap
        const buildDirWithSep = buildDir.endsWith(path.sep) ? buildDir : buildDir + path.sep;
        const classNameForJavap = targetClassFile
            .replace(buildDirWithSep, '') // Remove the build directory path prefix
            .replace(/\.class$/, '') // Remove the .class extension
            .replace(new RegExp(`\\${path.sep}`, 'g'), '.'); // Replace path separators with dots

        const classPathForJavap = buildDir;

        const runnerArgs = {
            mode: 'disassemble',
            classPath: classPathForJavap,
            className: classNameForJavap,
            workingDir: tempDir
        };
        
        const runnerSrcPath = path.join(process.cwd(), 'java_apps', 'src');
        const runnerBuildPath = path.join(process.cwd(), 'java_apps', 'build');
        await fs.mkdir(runnerBuildPath, { recursive: true });
        
        const mainJavaPath = path.join(runnerSrcPath, 'Main.java');
        const runnerCompileResult = await executeCommand('javac', ['-d', runnerBuildPath, mainJavaPath], runnerSrcPath);
        if(runnerCompileResult.code !== 0) {
            throw new Error(`Failed to compile the Java runner: ${runnerCompileResult.stderr}`);
        }
        
        const runnerResult = await executeCommand(
            'java', 
            ['-cp', runnerBuildPath, 'Main', JSON.stringify(runnerArgs)], 
            process.cwd()
        );

        if (runnerResult.code !== 0) {
            throw new Error(`Disassembly failed: ${runnerResult.stderr || runnerResult.stdout}`);
        }
        
        const output = JSON.parse(runnerResult.stdout);
        if (output.status !== 'success') {
             throw new Error(`Disassembly failed: ${output.message}`);
        }
        
        return NextResponse.json({ success: true, disassembledCode: output.disassembledCode });

    } catch (error: any) {
        console.error("Disassembly error:", error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    } finally {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(err => console.error(`Failed to remove temp dir ${tempDir}`, err));
        }
    }
}
