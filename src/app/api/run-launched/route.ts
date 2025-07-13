// This endpoint is now fully deprecated as its logic has been refactored
// into individual /api/run-[language] routes and the shared /lib/run-code.ts library.
// Kept for historical purposes but should not be used.
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    return NextResponse.json({ success: false, error: 'This endpoint is deprecated. Please use /api/run-[language] or /api/compile-java.' }, { status: 410 });
}
