import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { dataFromFrontend } = await req.json();

    const pythonScriptPath = path.join(process.cwd(), 'python_scripts', 'my_script.py');

    // Using a Promise to handle the asynchronous nature of the child process
    const result = await new Promise<{ success: boolean; data?: any; error?: string; pythonOutput?: string }>((resolve) => {
      const pythonProcess = spawn('python3', [pythonScriptPath, JSON.stringify(dataFromFrontend)]);
      
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
            const result = JSON.parse(pythonOutput);
            resolve({ success: true, data: result });
          } catch (parseError) {
            console.error('Ошибка парсинга JSON из Python:', parseError);
            resolve({ success: false, error: 'Некорректный вывод Python', pythonOutput });
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
      return NextResponse.json({ success: false, error: result.error, pythonOutput: result.pythonOutput }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Непредвиденная ошибка:', error);
    return NextResponse.json({ success: false, error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
