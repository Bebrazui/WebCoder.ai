// src/lib/run-code.ts
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';
import { compileSynthesis } from './synthesis_compiler';

type LanguageType = 'python' | 'java' | 'go' | 'ruby' | 'php' | 'rust' | 'csharp' | 'synthesis';
type BuildType = 'debug' | 'release';

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

function executeCommand(command: string, args: string[], cwd: string, shell: boolean = false): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve) => {
        console.log(`Executing: \`${command} ${args.join(' ')}\` in ${cwd}`);
        const process = spawn(command, args, { cwd, shell, stdio: 'pipe' }); // Changed to pipe for capturing
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => { stdout += data.toString(); console.log(`[${command} stdout]: ${data}`); });
        process.stderr.on('data', (data) => { stderr += data.toString(); console.error(`[${command} stderr]: ${data}`); });
        
        process.on('close', (code) => {
            console.log(`Command finished with code ${code}.`);
            resolve({ stdout, stderr, code });
        });

        process.on('error', (err: any) => {
            if (err.code === 'ENOENT') {
                 const errorMsg = `Failed to start process '${command}': command not found. Make sure native tools are installed and in your PATH.`;
                 resolve({ stdout: '', stderr: errorMsg, code: 127 });
            } else {
                const errorMsg = `Failed to start process '${command}': ${err.message}`;
                resolve({ stdout: '', stderr: errorMsg, code: -1 });
            }
        });
    });
}


const runSynthesis = async (config: any, tempDir: string) => {
    const programPath = path.join(tempDir, config.program!);
    try {
        const code = await fs.readFile(programPath, 'utf-8');
        const compiledJson = await compileSynthesis(code); // Expects JSON output
        
        // This is not an error, we are returning the compiled UI JSON
        return { stdout: compiledJson, stderr: '', code: 0 };
    } catch (error: any) {
        return { stdout: '', stderr: `Failed to read or compile SYNTHESIS file: ${error.message}`, code: 1 };
    }
}


// --- Language Runners ---

const runners = {
    synthesis: runSynthesis,
    python: async (config: any, tempDir: string) => {
        const scriptPath = path.join(tempDir, config.program!);
        const args = [scriptPath, JSON.stringify(config.args)];
        const primaryCommand = 'python3';
        const fallbackCommand = 'python';
        let result = await executeCommand(primaryCommand, args, tempDir);
        if (result.code === 127) { result = await executeCommand(fallbackCommand, args, tempDir); }
        return result;
    },
    java: async (config: any, tempDir: string) => {
        const userSourcePath = config.sourcePaths?.[0] || '.';
        const compilationCwd = path.join(tempDir, userSourcePath) || tempDir;
        const buildPath = path.join(tempDir, 'build');
        await fs.mkdir(buildPath, { recursive: true });
        const sourceFiles = (await fs.readdir(compilationCwd)).filter(f => f.endsWith('.java')).map(f => path.join(compilationCwd, f));
        if (sourceFiles.length === 0) return { stdout: 'No java files found.', stderr: '', code: 0 };
        const compileResult = await executeCommand('javac', ['-d', buildPath, ...sourceFiles], compilationCwd);
        if (compileResult.code !== 0) return compileResult;
        return executeCommand('java', ['-cp', buildPath, config.mainClass!, JSON.stringify(config.args)], tempDir);
    },
    go: async (config: any, tempDir: string) => {
        const programPath = path.join(tempDir, config.program!);
        return executeCommand('go', ['run', programPath, JSON.stringify(config.args)], path.dirname(programPath));
    },
    rust: async (config: any, tempDir: string) => {
        const projectPath = path.join(tempDir, config.cargo.projectPath);
        const buildResult = await executeCommand('cargo', config.cargo.args, projectPath);
        if (buildResult.code !== 0) return buildResult;
        const executablePath = path.join(projectPath, 'target', 'release', config.cargo.projectPath);
        return executeCommand(executablePath, [JSON.stringify(config.args)], projectPath);
    },
    csharp: async (config: any, tempDir: string) => {
        const projectPath = path.join(tempDir, config.projectPath);
        const buildDir = path.join(projectPath, '..', 'build');
        await fs.mkdir(buildDir, { recursive: true });
        const publishResult = await executeCommand('dotnet', ['publish', '-c', 'Release', '-o', buildDir], projectPath);
        if (publishResult.code !== 0) return publishResult;
        const executablePath = path.join(buildDir, path.basename(projectPath));
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
        if (result.code !== 0) {
            const errorMessage = result.stderr || result.stdout || `Process for ${language} exited with non-zero code.`;
            return NextResponse.json({ success: true, data: { stdout: result.stdout, stderr: errorMessage, hasError: true } }, { status: 200 });
        }
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
