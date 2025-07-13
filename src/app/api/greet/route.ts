import { type NextRequest, NextResponse } from 'next/server';

/**
 * @swagger
 * /api/greet:
 *   get:
 *     summary: Возвращает персональное приветствие
 *     description: Принимает имя в качестве query-параметра и возвращает JSON с приветственным сообщением.
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
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Привет, Мир!
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name') || 'Мир';

        const message = `Привет, ${name}!`;

        return NextResponse.json({ message });

    } catch (error: any) {
        console.error(`Error in /api/greet:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}
