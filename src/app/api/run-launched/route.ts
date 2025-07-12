
// This file is now deprecated and its logic has been moved to individual /api/run-[language] routes
// and the shared /lib/run-code.ts library.
// It is kept to prevent 404 errors but should not be used.

import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    return NextResponse.json({ success: false, error: 'This endpoint is deprecated. Please use /api/run-[language].' }, { status: 410 });
}

    