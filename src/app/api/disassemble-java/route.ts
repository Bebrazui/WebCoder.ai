
// src/app/api/disassemble-java/route.ts
'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { VFSNode } from '@/lib/vfs';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { dataURIToArrayBuffer } from '@/lib/utils';
import { runLanguage } from '@/lib/run-code';


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
    } else { // Fallback for flat array of files
        for (const file of projectFiles) {
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

        // --- Step 1: Compile the entire project first ---
        const compileConfig = { sourcePaths: ['.'] }; // Simple config for compilation
        const compileResult = await runLanguage('compile-java', projectFiles, compileConfig);
        const compileData = await compileResult.json();

        if (!compileData.success) {
            // It's not a critical error if compilation fails (e.g., no .java files), but we should report it if javap fails later.
            console.warn("Compilation step did not succeed, javap might fail.", compileData.error);
        }
        
        // --- Step 2: Determine the correct classpath and qualified class name ---
        const buildDir = path.join(tempDir, 'build');
        const cleanClassFilePath = classFilePath.startsWith('/') ? classFilePath.substring(1) : classFilePath;
        
        // The qualified class name is the path relative to the source root, without the .class extension
        // This is a heuristic. Assumes standard src/ or no-src folder structure.
        let qualifiedClassName = cleanClassFilePath.replace(/\.class$/, '').replace(new RegExp(`\\${path.sep}`, 'g'), '.');
        const srcPrefix = 'src.';
        if (qualifiedClassName.startsWith(srcPrefix)) {
            qualifiedClassName = qualifiedClassName.substring(srcPrefix.length);
        }
         // Also handle cases where project root is the source root
        const projectName = projectFiles[0].name;
        if (qualifiedClassName.startsWith(`${projectName}.`)) {
            qualifiedClassName = qualifiedClassName.substring(projectName.length + 1);
        }
        
        // --- Step 3: Run javap ---
        console.log(`Running javap for class: ${qualifiedClassName} with classpath: ${buildDir}`);
        const result = await executeCommand('javap', ['-c', qualifiedClassName], buildDir);

        if (result.code !== 0) {
            if (result.stderr.includes('class not found') || result.stderr.includes('ClassNotFoundException')) {
                 throw new Error(`javap could not find class '${qualifiedClassName}'. This often indicates a classpath or compilation issue. Please ensure the project compiles correctly.\n\nFull error:\n${result.stderr}`);
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
