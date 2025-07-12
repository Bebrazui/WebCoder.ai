
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { dataFromFrontend } = await req.json();

    const csharpAppPath = path.join(process.cwd(), 'csharp_apps', 'build', 'my_csharp_app');

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      // For .NET, we typically run the DLL with the `dotnet` command, but `dotnet publish` creates a self-contained executable.
      const csharpProcess = spawn(csharpAppPath, [JSON.stringify(dataFromFrontend)]);
      
      let csharpOutput = '';
      let csharpError = '';

      csharpProcess.stdout.on('data', (data) => {
        csharpOutput += data.toString();
      });

      csharpProcess.stderr.on('data', (data) => {
        csharpError += data.toString();
      });

      csharpProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const resultData = JSON.parse(csharpOutput);
            resolve({ success: true, data: resultData });
          } catch (parseError) {
            console.error('Ошибка парсинга JSON из C#:', parseError);
            resolve({ success: false, error: `Некорректный вывод C#: ${csharpOutput}` });
          }
        } else {
          console.error(`C#-процесс завершился с ошибкой ${code}:`, csharpError);
          try {
            const errorResult = JSON.parse(csharpError);
            resolve({ success: false, error: errorResult.message || 'Ошибка выполнения C#-приложения' });
          } catch (e) {
            resolve({ success: false, error: csharpError || 'Ошибка выполнения C#-приложения' });
          }
        }
      });

      csharpProcess.on('error', (err) => {
        console.error('Ошибка запуска C#-процесса:', err);
        resolve({ success: false, error: `Ошибка запуска C#: ${err.message}` });
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
