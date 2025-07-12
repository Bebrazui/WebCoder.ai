
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { VFSNode } from '@/lib/vfs';

async function createProjectInTempDir(projectFiles: VFSNode[]): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'python-project-'));

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
  let tempProjectPath = '';
  try {
    const { projectFiles, entryPoint, inputData } = await req.json();

    if (!projectFiles || !entryPoint) {
        return NextResponse.json({ success: false, error: 'Project files and entry point are required.' }, { status: 400 });
    }

    tempProjectPath = await createProjectInTempDir(projectFiles);
    const pythonScriptPath = path.join(tempProjectPath, entryPoint);

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      const pythonProcess = spawn('python3', [pythonScriptPath, JSON.stringify(inputData)]);
      
      let pythonOutput = '';
      let pythonError = '';

      pythonProcess.stdout.on('data', (data) => {
        pythonOutput += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        pythonError += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const resultData = JSON.parse(pythonOutput);
            resolve({ success: true, data: resultData });
          } catch (parseError: any) {
            console.error('Ошибка парсинга JSON из Python:', parseError);
            const detailedError = `Error parsing Python script output as JSON. Output was:\n---\n${pythonOutput}\n---\nParse Error: ${parseError.message}`;
            resolve({ success: false, error: detailedError });
          }
        } else {
          console.error(`Python-процесс завершился с ошибкой ${code}:`, pythonError);
          resolve({ success: false, error: pythonError || 'Ошибка выполнения Python-скрипта' });
        }
      });

      pythonProcess.on('error', (err) => {
        console.error('Ошибка запуска Python-процесса:', err);
        resolve({ success: false, error: `Ошибка запуска Python: ${err.message}` });
      });
    });

    if (result.success) {
      return NextResponse.json({ success: true, data: result.data });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Непредвиденная ошибка:', error);
    // Standardize error response
    if (error instanceof SyntaxError) { // Catches JSON.parse errors on the request body
        return NextResponse.json({ success: false, error: `Invalid JSON in request body: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Внутренняя ошибка сервера' }, { status: 500 });
  } finally {
      if (tempProjectPath) {
          await fs.rm(tempProjectPath, { recursive: true, force: true });
      }
  }
}
