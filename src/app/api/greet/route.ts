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
            // Возвращаем список задач для TodoApp.syn
            const initialTasks = [
                {id: 1, title: "Implement @effect", isCompleted: true},
                {id: 2, title: "Implement @binding", isCompleted: true},
                {id: 3, title: "Add ForEach component", isCompleted: false},
                {id: 4, title: "Support async/await", isCompleted: true},
                {id: 5, title: "Make it REAL!", isCompleted: false},
           ];
           return NextResponse.json(initialTasks);
        }

    } catch (error: any) {
        console.error(`Error in /api/greet:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}
