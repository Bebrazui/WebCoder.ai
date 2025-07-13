
import { type NextRequest, NextResponse } from 'next/server';
import { VFSNode } from '@/lib/vfs';
import { runLanguage } from '@/lib/run-code';

interface LaunchConfig {
    name: string;
    type: 'java';
    request: 'launch';
    mainClass?: string;
    sourcePaths?: string[];
    classPaths?: string[];
    args: any;
}

export async function POST(req: NextRequest) {
    try {
        const { projectFiles, config } = await req.json() as { projectFiles: VFSNode[], config: LaunchConfig };

        if (!projectFiles || !config || !config.mainClass) {
            return NextResponse.json({ success: false, error: 'Project files and a valid launch configuration with mainClass are required.' }, { status: 400 });
        }
        
        return await runLanguage('java', projectFiles, config);

    } catch (error: any) {
        console.error(`Error in /api/run-${'java'}:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}
