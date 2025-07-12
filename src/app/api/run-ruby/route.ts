import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { dataFromFrontend } = await req.json();

    const rubyScriptPath = path.join(process.cwd(), 'ruby_scripts', 'my_ruby_script.rb');

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      const rubyProcess = spawn('ruby', [rubyScriptPath, JSON.stringify(dataFromFrontend)]);
      
      let rubyOutput = '';
      let rubyError = '';

      rubyProcess.stdout.on('data', (data) => {
        rubyOutput += data.toString();
      });

      rubyProcess.stderr.on('data', (data) => {
        rubyError += data.toString();
      });

      rubyProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const resultData = JSON.parse(rubyOutput);
            resolve({ success: true, data: resultData });
          } catch (parseError) {
            console.error('Ошибка парсинга JSON из Ruby:', parseError);
            resolve({ success: false, error: `Некорректный вывод Ruby: ${rubyOutput}` });
          }
        } else {
          console.error(`Ruby-процесс завершился с ошибкой ${code}:`, rubyError);
          try {
            const errorResult = JSON.parse(rubyError);
            resolve({ success: false, error: errorResult.message || 'Ошибка выполнения Ruby-скрипта' });
          } catch (e) {
            resolve({ success: false, error: rubyError || 'Ошибка выполнения Ruby-скрипта' });
          }
        }
      });

      rubyProcess.on('error', (err) => {
        console.error('Ошибка запуска Ruby-процесса:', err);
        resolve({ success: false, error: `Ошибка запуска Ruby: ${err.message}` });
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
