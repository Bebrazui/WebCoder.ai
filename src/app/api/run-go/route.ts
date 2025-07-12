import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { existsSync, chmodSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { dataFromFrontend } = await req.json();

    const goAppPath = path.join(process.cwd(), 'go_apps', 'my_go_app');

    if (existsSync(goAppPath)) {
        try {
            chmodSync(goAppPath, '755');
        } catch (err) {
            console.warn(`Не удалось установить права на исполнение для ${goAppPath}:`, err);
        }
    }

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      const goProcess = spawn(goAppPath, [JSON.stringify(dataFromFrontend)]);
      
      let goOutput = '';
      let goError = '';

      goProcess.stdout.on('data', (data) => {
        goOutput += data.toString();
      });

      goProcess.stderr.on('data', (data) => {
        goError += data.toString();
      });

      goProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const resultData = JSON.parse(goOutput);
            resolve({ success: true, data: resultData });
          } catch (parseError) {
            console.error('Ошибка парсинга JSON из Go:', parseError);
            resolve({ success: false, error: `Некорректный вывод Go: ${goOutput}` });
          }
        } else {
          console.error(`Go-процесс завершился с ошибкой ${code}:`, goError);
          try {
            const errorResult = JSON.parse(goError);
            resolve({ success: false, error: errorResult.message || 'Ошибка выполнения Go-приложения' });
          } catch (e) {
            resolve({ success: false, error: goError || 'Ошибка выполнения Go-приложения' });
          }
        }
      });

      goProcess.on('error', (err) => {
        console.error('Ошибка запуска Go-процесса:', err);
        resolve({ success: false, error: `Ошибка запуска Go: ${err.message}` });
      });
    });

    if (result.success) {
      return NextResponse.json({ success: true, data: result.data });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Непредвиденная ошибка:', error);
    return NextResponse.json({ success: false, error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
