
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proj-jar-'));

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
        console.log(`Executing in JAR prep: \`${command} ${args.join(' ')}\` in ${cwd}`);
        const process = spawn(command, args, { cwd });
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => { stdout += data.toString(); });
        process.stderr.on('data', (data) => { stderr += data.toString(); });
        
        process.on('close', (code) => {
            console.log(`JAR Prep Command finished with code ${code}.`);
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

export async function POST(req: NextRequest) {
    let tempDir = '';
    try {
        const { projectFiles, config } = await req.json();

        tempDir = await createProjectInTempDir(projectFiles);

        const userSourcePath = config.sourcePaths?.[0] || '.';
        const compilationCwd = path.join(tempDir, userSourcePath);
        
        const buildPath = path.join(tempDir, 'build');
        await fs.mkdir(buildPath, { recursive: true });

        const sourceFiles = await findJavaFilesRecursive(compilationCwd);
        if (sourceFiles.length === 0) {
            throw new Error(`No Java source files found in: ${userSourcePath}.`);
        }
        
        // 1. Compile the code
        const compileResult = await executeCommand('javac', ['-d', buildPath, ...sourceFiles], compilationCwd);
        if (compileResult.code !== 0) {
            throw new Error(`Compilation failed: ${compileResult.stderr}`);
        }

        // 2. Create the JAR file
        const jarName = `${config.mainClass || 'app'}.jar`;
        const jarPath = path.join(tempDir, jarName);
        const jarResult = await executeCommand('jar', ['cfe', jarPath, config.mainClass, '.'], buildPath);
        if (jarResult.code !== 0) {
            throw new Error(`JAR creation failed: ${jarResult.stderr}`);
        }

        // 3. Move JAR to public directory
        const publicDir = path.join(process.cwd(), 'public', 'cheerpj');
        await fs.mkdir(publicDir, { recursive: true });
        const finalJarPath = path.join(publicDir, jarName);
        await fs.copyFile(jarPath, finalJarPath);

        const jarUrl = `/cheerpj/${jarName}`;
        
        return NextResponse.json({ success: true, jarUrl: jarUrl });

    } catch (error: any) {
        console.error(`Error in /api/prepare-jar:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    } finally {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(err => console.error(`Failed to remove temp dir ${tempDir}`, err));
        }
    }
}
