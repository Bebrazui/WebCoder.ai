
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { existsSync, chmodSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { dataFromFrontend } = await req.json();

    const rustAppPath = path.join(process.cwd(), 'rust_apps', 'my_rust_app');

    if (existsSync(rustAppPath)) {
        try {
            chmodSync(rustAppPath, '755');
        } catch (err) {
            console.warn(`Не удалось установить права на исполнение для ${rustAppPath}:`, err);
        }
    }

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      const rustProcess = spawn(rustAppPath, [JSON.stringify(dataFromFrontend)]);
      
      let rustOutput = '';
      let rustError = '';

      rustProcess.stdout.on('data', (data) => {
        rustOutput += data.toString();
      });

      rustProcess.stderr.on('data', (data) => {
        rustError += data.toString();
      });

      rustProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const resultData = JSON.parse(rustOutput);
            resolve({ success: true, data: resultData });
          } catch (parseError) {
            console.error('Ошибка парсинга JSON из Rust:', parseError);
            resolve({ success: false, error: `Некорректный вывод Rust: ${rustOutput}` });
          }
        } else {
          console.error(`Rust-процесс завершился с ошибкой ${code}:`, rustError);
          try {
            const errorResult = JSON.parse(rustError);
            resolve({ success: false, error: errorResult.message || 'Ошибка выполнения Rust-приложения' });
          } catch (e) {
            resolve({ success: false, error: rustError || 'Ошибка выполнения Rust-приложения' });
          }
        }
      });

      rustProcess.on('error', (err) => {
        console.error('Ошибка запуска Rust-процесса:', err);
        resolve({ success: false, error: `Ошибка запуска Rust: ${err.message}` });
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
