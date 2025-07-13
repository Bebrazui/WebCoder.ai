
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

        if (!projectFiles || !config) {
            return NextResponse.json({ success: false, error: 'Project files and a valid configuration are required.' }, { status: 400 });
        }
        
        // Use the 'compile-java' action
        return await runLanguage('compile-java', projectFiles, config);

    } catch (error: any) {
        console.error(`Error in /api/compile-java:`, error);
        return NextResponse.json({ success: false, error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}
