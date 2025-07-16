// src/app/api/compile-java/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode, VFSDirectory, createFile, createDirectory } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proj-compile-'));

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
    
    // The project files are usually passed as a single root directory node.
    // We want to write the *children* of that root node into our temp directory.
    if (projectFiles.length === 1 && projectFiles[0].type === 'directory') {
        const rootNode = projectFiles[0] as VFSDirectory;
        for (const child of rootNode.children) {
            await writeFileRecursive(child, tempDir);
        }
    } else { // Fallback for a flat array of files (less common case)
        for (const file of projectFiles) {
            await writeFileRecursive(file, tempDir);
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

const readBuildOutput = async (buildDir: string): Promise<VFSDirectory> => {
    const root = createDirectory('build', '/build');

    const readDir = async (currentDirPath: string, vfsParent: VFSDirectory) => {
        const entries = await fs.readdir(currentDirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDirPath, entry.name);
            const vfsPath = path.join(vfsParent.path, entry.name);
            if (entry.isDirectory()) {
                const dirNode = createDirectory(entry.name, vfsPath);
                await readDir(fullPath, dirNode);
                vfsParent.children.push(dirNode);
            } else if (entry.isFile() && entry.name.endsWith('.class')) {
                const content = await fs.readFile(fullPath);
                const dataUri = `data:application/java-vm;base64,${content.toString('base64')}`;
                vfsParent.children.push(createFile(entry.name, vfsPath, dataUri));
            }
        }
    };

    await readDir(buildDir, root);
    return root;
};


export async function POST(req: NextRequest) {
    let tempDir = '';
    try {
        const { projectFiles, config } = await req.json();
        tempDir = await createProjectInTempDir(projectFiles);

        // Determine source directory from config, default to root of temp dir
        const userSourcePath = config.sourcePaths?.[0] || '.';
        const compilationCwd = path.join(tempDir, userSourcePath);

        const buildDir = path.join(tempDir, 'build');
        await fs.mkdir(buildDir, { recursive: true });

        const sourceFiles = await findJavaFilesRecursive(compilationCwd);
        if (sourceFiles.length === 0) {
            return NextResponse.json({ success: false, error: "No Java source files found to compile." });
        }

        const result = await executeCommand('javac', ['-d', buildDir, ...sourceFiles], compilationCwd);

        if (result.code !== 0) {
            return NextResponse.json({ success: false, error: result.stderr || result.stdout });
        }
        
        const buildVfs = await readBuildOutput(buildDir);

        return NextResponse.json({ success: true, data: { message: "Compilation successful", buildOutput: buildVfs } });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    } finally {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(err => console.error(`Failed to remove temp dir ${tempDir}`, err));
        }
    }
}
