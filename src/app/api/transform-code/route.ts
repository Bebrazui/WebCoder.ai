// src/app/api/transform-code/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { transformCode, type TransformCodeInput } from '@/ai/flows/transform-code';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as TransformCodeInput;

        if (!body.code || !body.instruction) {
            return NextResponse.json({ success: false, error: 'Code and instruction are required.' }, { status: 400 });
        }

        const result = await transformCode(body);
        
        return NextResponse.json({ success: true, data: result });

    } catch (error: any) {
        console.error(`Error in /api/transform-code:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}
