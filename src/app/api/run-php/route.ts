
import { type NextRequest, NextResponse } from 'next/server';
import { VFSNode } from '@/lib/vfs';
import { runLanguage } from '@/lib/run-code';

interface LaunchConfig {
    name: string;
    type: 'php';
    request: 'launch';
    program?: string;
    args: any;
}

export async function POST(req: NextRequest) {
    try {
        const { projectFiles, config } = await req.json() as { projectFiles: VFSNode[], config: LaunchConfig };

        if (!projectFiles || !config || !config.program) {
            return NextResponse.json({ success: false, error: 'Project files and a valid launch configuration with a program path are required.' }, { status: 400 });
        }
        
        return await runLanguage(config.type, projectFiles, config);

    } catch (error: any) {
        console.error(`Error in /api/run-${'php'}:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}
    
