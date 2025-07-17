
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';

type LanguageType = 'python' | 'java' | 'go' | 'ruby' | 'php' | 'rust' | 'csharp';

// --- Utility Functions ---

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proj-'));

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

    // If projectFiles is [vfsRoot], we iterate its children into the tempDir
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

function executeCommand(command: string, args: string[], cwd: string, shell: boolean = false): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve) => {
        console.log(`Executing: \`${command} ${args.join(' ')}\` in ${cwd}`);
        const process = spawn(command, args, { cwd, shell });
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => { stdout += data.toString(); });
        process.stderr.on('data', (data) => { stderr += data.toString(); });
        
        process.on('close', (code) => {
            console.log(`Command finished with code ${code}.`);
            console.log(`Stdout: ${stdout}`);
            console.error(`Stderr: ${stderr}`);
            resolve({ stdout, stderr, code });
        });

        process.on('error', (err: any) => {
            // Specifically catch ENOENT
            if (err.code === 'ENOENT') {
                 const errorMsg = `Failed to start process '${command}': command not found.`;
                 console.error(errorMsg, err);
                 resolve({ stdout: '', stderr: errorMsg, code: 127 }); // 127 is common for "command not found"
            } else {
                const errorMsg = `Failed to start process '${command}': ${err.message}`;
                console.error(errorMsg);
                resolve({ stdout: '', stderr: errorMsg, code: -1 });
            }
        });
    });
}

// --- Java Specific Helpers ---

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
    const compilationCwd = path.join(tempDir, userSourcePath) || tempDir;
    
    const buildPath = path.join(tempDir, 'build');
    await fs.mkdir(buildPath, { recursive: true });

    const sourceFiles = await findJavaFilesRecursive(compilationCwd);
    
    if (sourceFiles.length === 0) {
        return { stdout: 'No java files found to compile.', stderr: '', code: 0 };
    }
    
    const jarFiles = (await findJavaFilesRecursive(tempDir)).filter(f => f.endsWith('.jar'));
    const classpath = [buildPath, ...jarFiles].join(path.delimiter);

    return executeCommand('javac', ['-d', buildPath, '-cp', classpath, ...sourceFiles], compilationCwd);
};

const runJava = async (config: any, tempDir: string) => {
    const compileResult = await compileJava(config, tempDir);
    if(compileResult.code !== 0) return compileResult;

    const buildPath = path.join(tempDir, 'build');
    const jarFiles = (await findJavaFilesRecursive(tempDir)).filter(f => f.endsWith('.jar'));
    const classpath = [buildPath, ...jarFiles].join(path.delimiter);

    const executionCwd = tempDir;
    
    return executeCommand('java', ['-cp', classpath, config.mainClass!, JSON.stringify(config.args)], executionCwd);
};


// --- Language Runners ---

const runners = {
    python: async (config: any, tempDir: string) => {
        const scriptPath = path.join(tempDir, config.program!);
        const args = [scriptPath, JSON.stringify(config.args)];
        
        // Use the specific command from the config if available (e.g., 'python3'),
        // otherwise default to a smart check.
        const primaryCommand = config.command === 'python' ? 'python' : 'python3';
        const fallbackCommand = primaryCommand === 'python' ? 'python3' : 'python';

        let result = await executeCommand(primaryCommand, args, tempDir);
        
        // If the specified command failed with "command not found", try the fallback.
        if (result.code === 127) {
            console.log(`\`${primaryCommand}\` not found, trying \`${fallbackCommand}\`...`);
            result = await executeCommand(fallbackCommand, args, tempDir);
        }
        
        return result;
    },

    java: runJava,

    go: async (config: any, tempDir: string) => {
        const programPath = path.join(tempDir, config.program!);
        const programDir = path.dirname(programPath);
        return executeCommand('go', ['run', programPath, JSON.stringify(config.args)], programDir);
    },
    
    rust: async (config: any, tempDir: string) => {
        const projectPath = path.join(tempDir, config.cargo.projectPath);
        const buildResult = await executeCommand('cargo', config.cargo.args, projectPath);
        if (buildResult.code !== 0) return buildResult;

        const executableName = config.cargo.projectPath;
        const executablePath = path.join(projectPath, 'target', 'release', executableName);

        return executeCommand(executablePath, [JSON.stringify(config.args)], projectPath);
    },
    
    csharp: async (config: any, tempDir: string) => {
        const projectPath = path.join(tempDir, config.projectPath);
        const buildDir = path.join(projectPath, '..', 'build');
        await fs.mkdir(buildDir, { recursive: true });

        const publishResult = await executeCommand('dotnet', ['publish', '-c', 'Release', '-o', buildDir], projectPath);
        if (publishResult.code !== 0) return publishResult;
        
        const executableName = path.basename(projectPath);
        const executablePath = path.join(buildDir, executableName);

        return executeCommand(executablePath, [JSON.stringify(config.args)], tempDir);
    },
    
    php: async (config: any, tempDir: string) => {
        const scriptPath = path.join(tempDir, config.program!);
        return executeCommand('php', [scriptPath, JSON.stringify(config.args)], tempDir);
    },

    ruby: async (config: any, tempDir: string) => {
        const scriptPath = path.join(tempDir, config.program!);
        return executeCommand('ruby', [scriptPath, JSON.stringify(config.args)], tempDir);
    },
};

export async function runLanguage(language: LanguageType, projectFiles: VFSNode[], config: any) {
    let tempDir = '';
    try {
        tempDir = await createProjectInTempDir(projectFiles);
        const runner = runners[language];

        if (!runner) {
            return NextResponse.json({ success: false, error: `Unsupported launch type: ${language}` }, { status: 400 });
        }

        const result = await runner(config, tempDir);

        // Treat code 127 (command not found) as a special case for a clearer error message
        if (result.code === 127) {
            return NextResponse.json({ success: true, data: { stdout: result.stdout, stderr: result.stderr || `The command for '${language}' was not found in the system's PATH.`, hasError: true } }, { status: 200 });
        }

        if (result.code !== 0) {
            const errorMessage = result.stderr || result.stdout || `Process for ${language} exited with non-zero code.`;
            return NextResponse.json({ success: true, data: { stdout: result.stdout, stderr: errorMessage, hasError: true } }, { status: 200 });
        }
        
        // Success case
        return NextResponse.json({ success: true, data: { stdout: result.stdout, stderr: result.stderr, hasError: false } });

    } catch (error: any) {
        console.error(`Error in runLanguage for ${language}:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    } finally {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(err => console.error(`Failed to remove temp dir ${tempDir}`, err));
        }
    }
}
