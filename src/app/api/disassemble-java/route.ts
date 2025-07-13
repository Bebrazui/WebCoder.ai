// src/app/api/disassemble-java/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { type VFSNode, type VFSDirectory } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';

async function createProjectInTempDir(projectRoot: VFSDirectory): Promise<string> {
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
    
    // Write the entire project structure into the temp directory
    for (const child of projectRoot.children) {
      await writeFile(child, tempDir);
    }

    return tempDir;
}

const findJavaFilesRecursive = async (dir: string): Promise<string[]> => {
    let results: string[] = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const file of list) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(await findJavaFilesRecursive(fullPath));
        } else if (file.name.endsWith('.java')) {
            results.push(fullPath);
        }
    }
    return results;
};

const findClassFilesRecursive = async (dir: string): Promise<string[]> => {
    let results: string[] = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const file of list) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(await findClassFilesRecursive(fullPath));
        } else if (file.name.endsWith('.class')) {
            results.push(fullPath);
        }
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

const findPotentialSrcRoots = async (startDir: string): Promise<string[]> => {
    const roots = new Set<string>();
    const javaFiles = await findJavaFilesRecursive(startDir);
    for (const file of javaFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const packageMatch = content.match(/^package\s+([\w\.]+);/);
        if (packageMatch) {
            const packagePath = packageMatch[1].replace(/\./g, '/');
            const fullPath = path.dirname(file);
            if (fullPath.endsWith(packagePath)) {
                roots.add(fullPath.substring(0, fullPath.length - packagePath.length));
            }
        } else {
             roots.add(path.dirname(file));
        }
    }
     if (roots.size === 0) {
        roots.add(startDir); // Fallback to root if no packages found
    }
    return Array.from(roots);
};

export async function POST(req: NextRequest) {
    let tempDir = '';
    try {
        const { projectRoot, filePath } = await req.json() as { projectRoot: VFSDirectory, filePath: string };
        tempDir = await createProjectInTempDir(projectRoot);

        // --- Compilation Step ---
        const buildDir = path.join(tempDir, 'build');
        await fs.mkdir(buildDir, { recursive: true });
        
        const srcRoots = await findPotentialSrcRoots(tempDir);
        if (srcRoots.length === 0) {
            throw new Error("Could not determine Java source root directory.");
        }
        
        // Compile all java files found from all potential source roots
        const allJavaFiles = (await Promise.all(srcRoots.map(root => findJavaFilesRecursive(root))))
            .flat()
            .filter((v, i, a) => a.indexOf(v) === i); // Unique files

        if (allJavaFiles.length > 0) {
            const compileResult = await executeCommand('javac', ['-d', buildDir, ...allJavaFiles], tempDir);
            if (compileResult.code !== 0) {
                throw new Error(`Compilation failed: ${compileResult.stderr}`);
            }
        }
        
        // --- Disassembly Step ---
        const classFilePath = path.join(buildDir, ...filePath.split('/')).replace(/\.java$/, '.class');
        
        // Determine the fully qualified class name from the file path relative to a src root.
        let className = '';
        const buildPathWithSep = buildDir.endsWith(path.sep) ? buildDir : buildDir + path.sep;

        // Find the corresponding .class file path in the build directory.
        const allClassFiles = await findClassFilesRecursive(buildDir);
        const targetClassFile = allClassFiles.find(f => f.endsWith(path.basename(filePath).replace('.java', '.class')));

        if (!targetClassFile) {
            // It might already be a .class file path
            const potentialClassPath = path.join(tempDir, ...filePath.split('/'));
            try {
                await fs.access(potentialClassPath);
                // The class file exists outside the standard build process. Let's find its root.
                className = filePath.replace(/\//g, '.').replace(/\.class$/, '');

            } catch(e) {
                 throw new Error(`Could not find compiled class for ${filePath}. Looked for ${targetClassFile}`);
            }
        } else {
            className = targetClassFile.replace(buildPathWithSep, '').replace(/\.class$/, '').replace(new RegExp(`\\${path.sep}`, 'g'), '.');
        }


        const classPathForJavap = [buildDir, tempDir].join(path.delimiter);

        const runnerArgs = {
            mode: 'disassemble',
            classPath: classPathForJavap,
            className: className,
            workingDir: tempDir
        };

        // Locate the pre-compiled runner JAR
        const sourcesTxtPath = path.join(process.cwd(), 'java_apps', 'sources.txt');
        const javaFilesForRunner = (await fs.readFile(sourcesTxtPath, 'utf-8')).trim().split('\n');
        
        const buildRunnerPath = path.join(process.cwd(), 'java_apps', 'build');
        const mainJavaRunnerPath = path.join(process.cwd(), javaFilesForRunner[0]);
        
        // Simplified runner logic
        const runnerResult = await executeCommand(
            'java', 
            ['-cp', buildRunnerPath, 'Main', JSON.stringify(runnerArgs)], 
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
