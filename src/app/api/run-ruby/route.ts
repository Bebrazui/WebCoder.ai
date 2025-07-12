
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruby-project-'));

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
        const rubyScriptPath = path.join(tempProjectPath, entryPoint);

        const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
            const rubyProcess = spawn('ruby', [rubyScriptPath, JSON.stringify(inputData)]);
            
            let rubyOutput = '';
            let rubyError = '';

            rubyProcess.stdout.on('data', (data) => { rubyOutput += data.toString(); });
            rubyProcess.stderr.on('data', (data) => { rubyError += data.toString(); });

            rubyProcess.on('close', (code) => {
                fs.rm(tempProjectPath, { recursive: true, force: true }); // Cleanup
                if (code === 0) {
                    try {
                        const resultData = JSON.parse(rubyOutput);
                        resolve({ success: true, data: resultData });
                    } catch (parseError) {
                        resolve({ success: false, error: `Error parsing Ruby output: ${rubyOutput}` });
                    }
                } else {
                    try {
                        const errorResult = JSON.parse(rubyError);
                        resolve({ success: false, error: errorResult.message || 'Ruby script execution failed.' });
                    } catch (e) {
                        resolve({ success: false, error: rubyError || 'Ruby script execution failed.' });
                    }
                }
            });

            rubyProcess.on('error', (err) => {
                fs.rm(tempProjectPath, { recursive: true, force: true }); // Cleanup
                resolve({ success: false, error: `Failed to start Ruby process: ${err.message}` });
            });
        });

        if (result.success) {
            return NextResponse.json({ success: true, data: result.data });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Unexpected error in /api/run-ruby:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
