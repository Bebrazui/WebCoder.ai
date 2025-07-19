// This endpoint is fully deprecated and no longer used.
// Logic has been refactored into /api/run-[language] routes.
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    return NextResponse.json({ success: false, error: 'This endpoint is deprecated. Please use /api/run-[language].' }, { status: 410 });
}
