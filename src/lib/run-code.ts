
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';
import { dataURIToArrayBuffer } from '@/lib/utils';

type LanguageType = 'python' | 'java' | 'go' | 'ruby' | 'php' | 'rust' | 'csharp' | 'compile-java';

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

    for (const file of projectFiles) {
        await writeFile(file, tempDir);
    }
    return tempDir;
}

function executeCommand(command: string, args: string[], cwd: string, shell: boolean = false): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve) => {
        const process = spawn(command, args, { cwd, shell }); 
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

// --- Java Specific Helpers ---

const findJavaFilesRecursive = async (dir: string): Promise<string[]> => {
    let results: string[] = [];
    try {
        await fs.access(dir); // Check if directory exists
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
    const buildPath = path.join(tempDir, 'build');
    await fs.mkdir(buildPath, { recursive: true });

    let sourceFiles: string[] = [];
    
    // Use user-provided source path if available, otherwise default.
    const sourcePaths = config.sourcePaths && Array.isArray(config.sourcePaths) ? config.sourcePaths : ['.'];
    
    console.log(`Using sourcePaths to find Java files: ${sourcePaths.join(', ')}`);
    for (const srcPath of sourcePaths) {
        const fullSrcPath = path.join(tempDir, srcPath);
        sourceFiles.push(...await findJavaFilesRecursive(fullSrcPath));
    }
    
    if (sourceFiles.length === 0) {
        return { stdout: '', stderr: 'No Java source files found in the specified Source Path. Please check the path is correct.', code: 1 };
    }
    console.log(`Found ${sourceFiles.length} Java files to compile.`);
    
    // The CWD for compilation should be the temp directory to handle packages correctly.
    const compilationCwd = tempDir;
    const classPaths = (config.classPaths || []).map((p: string) => path.join(tempDir, p)).join(path.delimiter);
    const cpArgs = classPaths ? ['-cp', classPaths] : [];
    
    console.log(`Compiling with javac -d ${buildPath} from CWD: ${compilationCwd}`);

    // The source files should be relative to the CWD
    const relativeSourceFiles = sourceFiles.map(f => path.relative(compilationCwd, f));

    return await executeCommand('javac', ['-d', buildPath, ...cpArgs, ...relativeSourceFiles], compilationCwd);
};


const runJava = async (config: any, tempDir: string) => {
    const buildPath = path.join(tempDir, 'build');
    const userSourcePath = (config.sourcePaths && Array.isArray(config.sourcePaths)) ? config.sourcePaths[0] : '.';
    const executionRoot = path.join(tempDir, userSourcePath);

    // The classpath should contain the 'build' directory AND the execution root (for resources)
    const classPaths = (config.classPaths || []).map((p: string) => path.join(tempDir, p)).join(path.delimiter);
    const cp = `${buildPath}${path.delimiter}${executionRoot}${classPaths ? path.delimiter + classPaths : ''}`;
    
    // The CWD should be the root of the temporary project.
    const executionCwd = tempDir;

    console.log(`Running Java with classpath: '${cp}' from CWD: '${executionCwd}' for main class: '${config.mainClass!}'`);
    return executeCommand('java', ['-cp', cp, config.mainClass!, JSON.stringify(config.args)], executionCwd);
};


// --- Language Runners ---

const runners = {
    python: async (config: any, tempDir: string) => {
        const scriptPath = path.join(tempDir, config.program!);
        return executeCommand('python3', [scriptPath, JSON.stringify(config.args)], tempDir);
    },

    java: runJava,
    'compile-java': compileJava,

    go: async (config: any, tempDir: string) => {
        const programDir = path.dirname(path.join(tempDir, config.program!));
        const appName = path.basename(config.program!).replace('.go', '');
        const outputPath = path.join(programDir, appName);

        const compileResult = await executeCommand('go', ['build', '-o', outputPath, '.'], programDir);
        if (compileResult.code !== 0) return compileResult;

        return executeCommand(outputPath, [JSON.stringify(config.args)], tempDir);
    },

    ruby: async (config: any, tempDir: string) => {
        const scriptPath = path.join(tempDir, config.program!);
        return executeCommand('ruby', [scriptPath, JSON.stringify(config.args)], tempDir);
    },

    php: async (config: any, tempDir: string) => {
        const scriptPath = path.join(tempDir, config.program!);
        return executeCommand('php', [scriptPath, JSON.stringify(config.args)], tempDir);
    },

    rust: async (config: any, tempDir: string) => {
        const cargoConfig = config.cargo!;
        const projectPath = path.join(tempDir, cargoConfig.projectPath);

        const compileResult = await executeCommand('cargo', cargoConfig.args, projectPath);
        if (compileResult.code !== 0) return compileResult;

        const manifest = await fs.readFile(path.join(projectPath, 'Cargo.toml'), 'utf-8');
        const packageNameMatch = /name\s*=\s*"([^"]+)"/.exec(manifest);
        if (!packageNameMatch) {
             return { stdout: '', stderr: 'Could not find package name in Cargo.toml', code: 1 };
        }
        const packageName = packageNameMatch[1];
        
        const appPath = path.join(projectPath, 'target', 'release', packageName);
        return executeCommand(appPath, [JSON.stringify(config.args)], projectPath);
    },

    csharp: async (config: any, tempDir: string) => {
        const projectPath = path.join(tempDir, config.projectPath!);
        const projectName = path.basename(config.projectPath!);
        
        const publishDir = path.join(projectPath, "bin/Release/net8.0/publish");

        const compileResult = await executeCommand('dotnet', ['publish', '-c', 'Release'], projectPath);
        if (compileResult.code !== 0) return compileResult;
        
        const dllPath = path.join(publishDir, `${projectName}.dll`);
        try {
            await fs.access(dllPath)
        } catch (e) {
             return { stdout: '', stderr: `Could not find published DLL at ${dllPath}`, code: 1 };
        }

        return executeCommand('dotnet', [dllPath, JSON.stringify(config.args)], projectPath);
    }
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
            // Prefer stderr, but if it's empty, use stdout as the error source.
            const errorMessage = result.stderr || result.stdout || `Process for ${language} exited with non-zero code.`;
            return NextResponse.json({ success: false, error: errorMessage }, { status: 200 }); // status 200 for controlled errors
        }

        try {
            // For compilation, we might not have a JSON output, just success message
            if (language === 'compile-java') {
                 return NextResponse.json({ success: true, data: { message: "Compilation successful.", details: result.stdout } });
            }
            if (!result.stdout.trim()) {
                 return NextResponse.json({ success: true, data: { message: "Process executed successfully with no output." } });
            }
            const parsedOutput = JSON.parse(result.stdout);
            return NextResponse.json({ success: true, data: parsedOutput });
        } catch (e) {
            const errorMessage = result.stderr || `Could not parse process output as JSON. Raw output:\n${result.stdout}`;
            return NextResponse.json({ success: false, error: errorMessage }, { status: 200 });
        }
    } catch (error: any) {
        console.error(`Error in runLanguage for ${language}:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    } finally {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(err => console.error(`Failed to remove temp dir ${tempDir}`, err));
        }
    }
}
