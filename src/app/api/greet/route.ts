import { type NextRequest, NextResponse } from 'next/server';

/**
 * @swagger
 * /api/greet:
 *   get:
 *     summary: Возвращает персональное приветствие или список задач
 *     description: Принимает имя в качестве query-параметра и возвращает JSON с приветственным сообщением. Если имя не указано, возвращает массив задач.
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Имя для приветствия.
 *         required: false
 *     responses:
 *       200:
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Привет, Гость!
 *                 - type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       isCompleted:
 *                         type: boolean
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name');

        if (name) {
            const message = `Привет, ${name}!`;
            return NextResponse.json({ message });
        } else {
            // Возвращаем список задач для TodoApp.syn - теперь это просто начальные данные по умолчанию
            const initialTasks = [
                {id: 1, title: "Learn SYNTHESIS State", isCompleted: true},
                {id: 2, title: "Implement Storage library", isCompleted: true},
                {id: 3, title: "Add persistence to TodoApp", isCompleted: true},
                {id: 4, title: "Check OS.platform", isCompleted: false},
                {id: 5, title: "Build a real app!", isCompleted: false},
           ];
           return NextResponse.json(initialTasks);
        }

    } catch (error: any) {
        console.error(`Error in /api/greet:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}
