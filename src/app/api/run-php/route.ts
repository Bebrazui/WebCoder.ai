
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'php-project-'));

    const writeFile = async (node: VFSNode, currentPath: string) => {
        const fullPath = path.join(currentPath, node.name);
        if (node.type === 'directory') {
            await fs.mkdir(fullPath, { recursive: true });
            for (const child of node.children) {
                await writeFile(child, fullPath);
            }
        } else {
            await fs.writeFile(fullPath, node.content);
        }
    };

    for (const file of projectFiles) {
        await writeFile(file, tempDir);
    }
    
    return tempDir;
}

export async function POST(req: NextRequest) {
    try {
        const { projectFiles, entryPoint, inputData } = await req.json();

        if (!projectFiles || !entryPoint) {
            return NextResponse.json({ success: false, error: 'Project files and entry point are required.' }, { status: 400 });
        }

        const tempProjectPath = await createProjectInTempDir(projectFiles);
        const phpScriptPath = path.join(tempProjectPath, entryPoint);

        const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
            const phpProcess = spawn('php', [phpScriptPath, JSON.stringify(inputData)]);
            
            let phpOutput = '';
            let phpError = '';

            phpProcess.stdout.on('data', (data) => { phpOutput += data.toString(); });
            phpProcess.stderr.on('data', (data) => { phpError += data.toString(); });

            phpProcess.on('close', (code) => {
                fs.rm(tempProjectPath, { recursive: true, force: true }); // Cleanup
                if (code === 0) {
                    try {
                        const resultData = JSON.parse(phpOutput);
                        resolve({ success: true, data: resultData });
                    } catch (parseError) {
                        resolve({ success: false, error: `Error parsing PHP output: ${phpOutput}` });
                    }
                } else {
                     try {
                        const errorResult = JSON.parse(phpError);
                        resolve({ success: false, error: errorResult.message || 'PHP script execution failed.' });
                    } catch (e) {
                        resolve({ success: false, error: phpError || 'PHP script execution failed.' });
                    }
                }
            });

            phpProcess.on('error', (err) => {
                fs.rm(tempProjectPath, { recursive: true, force: true }); // Cleanup
                resolve({ success: false, error: `Failed to start PHP process: ${err.message}` });
            });
        });

        if (result.success) {
            return NextResponse.json({ success: true, data: result.data });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Unexpected error in /api/run-php:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
