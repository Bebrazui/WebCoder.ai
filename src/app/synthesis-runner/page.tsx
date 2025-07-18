// src/app/synthesis-runner/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SynthesisRenderer } from '@/components/synthesis-renderer';

export default function SynthesisRunnerPage() {
    const searchParams = useSearchParams();
    const [uiJson, setUiJson] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const data = searchParams.get('data');
        if (data) {
            try {
                const decodedData = decodeURIComponent(data);
                const parsedJson = JSON.parse(decodedData);
                if (parsedJson.type === 'Error') {
                    setError(`Compilation Error: ${parsedJson.message}`);
                    console.error(parsedJson.stack);
                } else {
                    setUiJson(parsedJson);
                }
            } catch (e: any) {
                setError(`Failed to parse UI data: ${e.message}`);
            }
        } else {
            // Check localStorage as a fallback for Electron
            const storedData = localStorage.getItem('synthesis_ui_data');
            if (storedData) {
                try {
                    const parsedJson = JSON.parse(storedData);
                     if (parsedJson.type === 'Error') {
                        setError(`Compilation Error: ${parsedJson.message}`);
                        console.error(parsedJson.stack);
                    } else {
                        setUiJson(parsedJson);
                    }
                    localStorage.removeItem('synthesis_ui_data'); // Clean up
                } catch(e: any) {
                    setError(`Failed to parse UI data from storage: ${e.message}`);
                }
            } else {
                setError("No UI data provided.");
            }
        }
    }, [searchParams]);

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-900 p-4">
                <div className="max-w-2xl text-center">
                    <h1 className="text-2xl font-bold mb-2">Runner Error</h1>
                    <pre className="bg-red-200 p-4 rounded-md text-left whitespace-pre-wrap">{error}</pre>
                </div>
            </div>
        );
    }
    
    if (!uiJson) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                Loading UI...
            </div>
        );
    }

    return (
        <div className="bg-gray-100 min-h-screen p-4">
            <SynthesisRenderer uiJson={uiJson} />
        </div>
    );
}
