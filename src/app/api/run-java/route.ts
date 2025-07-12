import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { dataFromFrontend } = await req.json();

    const javaAppPath = path.join(process.cwd(), 'java_apps', 'build');
    const javaLibPath = path.join(process.cwd(), 'java_apps', 'lib');
    const javaClassName = 'MyJavaApp';

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      const classPathSeparator = process.platform === 'win32' ? ';' : ':';
      const classPath = `${javaAppPath}${classPathSeparator}${javaLibPath}/*`;

      const javaProcess = spawn('java', [
        '-cp',
        classPath,
        javaClassName,
        JSON.stringify(dataFromFrontend),
      ]);

      let javaOutput = '';
      let javaError = '';

      javaProcess.stdout.on('data', (data) => {
        javaOutput += data.toString();
      });

      javaProcess.stderr.on('data', (data) => {
        javaError += data.toString();
      });

      javaProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const resultData = JSON.parse(javaOutput);
            resolve({ success: true, data: resultData });
          } catch (parseError) {
            console.error('Ошибка парсинга JSON из Java:', parseError);
            resolve({ success: false, error: `Некорректный вывод Java: ${javaOutput}` });
          }
        } else {
          console.error(`Java-процесс завершился с ошибкой ${code}:`, javaError);
          try {
            const errorResult = JSON.parse(javaError);
            resolve({ success: false, error: errorResult.message || 'Ошибка выполнения Java-приложения' });
          } catch (e) {
            resolve({ success: false, error: javaError || 'Ошибка выполнения Java-приложения' });
          }
        }
      });

      javaProcess.on('error', (err) => {
        console.error('Ошибка запуска Java-процесса:', err);
        resolve({ success: false, error: `Ошибка запуска Java: ${err.message}` });
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
