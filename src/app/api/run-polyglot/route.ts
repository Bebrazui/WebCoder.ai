
'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';

interface PolyglotStep {
    name: string;
    language: 'python' | 'java' | 'go' | 'ruby' | 'php' | 'rust' | 'csharp';
    entryPoint: string;
    input: any; // Input for this specific step
}

interface PolyglotScenario {
    steps: PolyglotStep[];
}

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'polyglot-project-'));

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

async function executeCommand(command: string, args: string[], cwd: string): Promise<{ stdout: string, stderr: string, code: number | null }> {
    return new Promise((resolve) => {
        const process = spawn(command, args, { cwd });
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => { stdout += data.toString(); });
        process.stderr.on('data', (data) => { stderr += data.toString(); });
        
        process.on('close', (code) => {
            resolve({ stdout, stderr, code });
        });
        process.on('error', (err) => {
            resolve({ stdout: '', stderr: `Failed to start process '${command}': ${err.message}`, code: -1 });
        });
    });
}

const languageRunners = {
    python: async (projectPath: string, entryPoint: string, inputData: any) => {
        const scriptPath = path.join(projectPath, entryPoint);
        return executeCommand('python3', [scriptPath, JSON.stringify(inputData)], projectPath);
    },
    java: async (projectPath: string, entryPoint: string, inputData: any) => {
        const sourcesPath = path.join(projectPath, 'src');
        const buildPath = path.join(projectPath, 'build');
        const libPath = path.join(projectPath, 'lib');

        // Simplified compilation
        const compileResult = await executeCommand('javac', ['-d', buildPath, '-cp', `${buildPath}:${libPath}/*`, ... (await fs.readdir(sourcesPath)).filter(f => f.endsWith('.java')).map(f => path.join(sourcesPath, f))  ], projectPath);
        if (compileResult.code !== 0) return { ...compileResult, stdout: '' };

        const classPath = `${buildPath}:${libPath}/*`;
        return executeCommand('java', ['-cp', classPath, entryPoint, JSON.stringify(inputData)], projectPath);
    },
    go: async (projectPath: string, entryPoint: string, inputData: any) => {
        const outputPath = path.join(projectPath, 'my_go_app');
        const compileResult = await executeCommand('go', ['build', '-o', outputPath, entryPoint], projectPath);
        if (compileResult.code !== 0) return { ...compileResult, stdout: '' };
        
        return executeCommand(outputPath, [JSON.stringify(inputData)], projectPath);
    },
     ruby: async (projectPath: string, entryPoint: string, inputData: any) => {
        const scriptPath = path.join(projectPath, entryPoint);
        return executeCommand('ruby', [scriptPath, JSON.stringify(inputData)], projectPath);
    },
    php: async (projectPath: string, entryPoint: string, inputData: any) => {
        const scriptPath = path.join(projectPath, entryPoint);
        return executeCommand('php', [scriptPath, JSON.stringify(inputData)], projectPath);
    },
    rust: async (projectPath: string, entryPoint: string, inputData: any) => {
        const compileResult = await executeCommand('cargo', ['build', '--release'], projectPath);
        if (compileResult.code !== 0) return { ...compileResult, stdout: '' };
        
        const manifest = await fs.readFile(path.join(projectPath, 'Cargo.toml'), 'utf-8');
        const packageName = /name\s*=\s*"([^"]+)"/.exec(manifest)?.[1] || 'rust_apps';
        const appPath = path.join(projectPath, 'target', 'release', packageName);

        return executeCommand(appPath, [JSON.stringify(inputData)], projectPath);
    },
    csharp: async (projectPath: string, entryPoint: string, inputData: any) => {
        const projectDir = path.join(projectPath, entryPoint);
        const buildPath = path.join(projectPath, 'build');
        const compileResult = await executeCommand('dotnet', ['publish', '-c', 'Release', '-o', buildPath], projectDir);
        if (compileResult.code !== 0) return { ...compileResult, stdout: '' };
        
        const appPath = path.join(buildPath, entryPoint);
        return executeCommand(appPath, [JSON.stringify(inputData)], projectPath);
    }
};

export async function POST(req: NextRequest) {
    const { projectFiles, scenario } = await req.json() as { projectFiles: VFSNode[], scenario: PolyglotScenario };

    if (!projectFiles || !scenario || !scenario.steps) {
        return NextResponse.json({ success: false, error: 'Project files and a valid scenario are required.' }, { status: 400 });
    }

    const tempProjectPath = await createProjectInTempDir(projectFiles);
    
    const results = [];
    let previousStepOutput: any = {};

    try {
        for (const step of scenario.steps) {
            const runner = languageRunners[step.language];
            if (!runner) {
                throw new Error(`Unsupported language in scenario step "${step.name}": ${step.language}`);
            }

            // Merge step input with previous step's output
            const currentInput = { ...step.input, ...previousStepOutput };
            
            const result = await runner(tempProjectPath, step.entryPoint, currentInput);
            
            if (result.code !== 0) {
                 throw new Error(`Step "${step.name}" failed with code ${result.code}:\n${result.stderr || result.stdout}`);
            }

            try {
                previousStepOutput = JSON.parse(result.stdout);
                results.push({ step: step.name, success: true, output: previousStepOutput });
            } catch (e) {
                // If output is not JSON, pass it as a raw string
                previousStepOutput = { rawOutput: result.stdout };
                 results.push({ step: step.name, success: true, output: previousStepOutput });
            }
        }
        
        return NextResponse.json({ success: true, data: { finalOutput: previousStepOutput, allSteps: results } });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        await fs.rm(tempProjectPath, { recursive: true, force: true });
    }
}
