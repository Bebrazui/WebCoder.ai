
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { dataFromFrontend } = await req.json();

    const phpScriptPath = path.join(process.cwd(), 'php_scripts', 'my_php_script.php');

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      const phpProcess = spawn('php', [phpScriptPath, JSON.stringify(dataFromFrontend)]);
      
      let phpOutput = '';
      let phpError = '';

      phpProcess.stdout.on('data', (data) => {
        phpOutput += data.toString();
      });

      phpProcess.stderr.on('data', (data) => {
        phpError += data.toString();
      });

      phpProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const resultData = JSON.parse(phpOutput);
            resolve({ success: true, data: resultData });
          } catch (parseError) {
            console.error('Ошибка парсинга JSON из PHP:', parseError);
            resolve({ success: false, error: `Некорректный вывод PHP: ${phpOutput}` });
          }
        } else {
          console.error(`PHP-процесс завершился с ошибкой ${code}:`, phpError);
          try {
            const errorResult = JSON.parse(phpError);
            resolve({ success: false, error: errorResult.message || 'Ошибка выполнения PHP-скрипта' });
          } catch (e) {
            resolve({ success: false, error: phpError || 'Ошибка выполнения PHP-скрипта' });
          }
        }
      });

      phpProcess.on('error', (err) => {
        console.error('Ошибка запуска PHP-процесса:', err);
        resolve({ success: false, error: `Ошибка запуска PHP: ${err.message}` });
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
