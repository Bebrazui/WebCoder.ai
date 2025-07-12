
"use client";

import { useState } from "react";
import type { VFSFile } from "@/lib/vfs";
import { Button } from "./ui/button";
import { LoaderCircle, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { decompileJavaClass } from "@/ai/flows/decompile-java-flow";
import { CodeEditor } from "./code-editor";
import { FileIcon } from "./file-icon";

interface JavaDecompilerViewerProps {
    file: VFSFile;
}

export function JavaDecompilerViewer({ file }: JavaDecompilerViewerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [decompiledCode, setDecompiledCode] = useState<string | null>(null);
    const { toast } = useToast();

    const handleDecompile = async () => {
        setIsLoading(true);
        setDecompiledCode(null);
        try {
            const result = await decompileJavaClass({ 
                fileName: file.name,
                fileContent: file.content 
            });
            setDecompiledCode(result.decompiledCode);
        } catch (error) {
            console.error("Decompilation failed:", error);
            toast({
                variant: "destructive",
                title: "Decompilation Failed",
                description: "The AI could not decompile the file. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (decompiledCode) {
        const newFileName = file.name.replace(/\.class$/, '.java');
        return (
            <CodeEditor
                path={newFileName}
                value={decompiledCode}
                onChange={() => {}} // Read-only
            />
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full bg-muted/20 p-4 text-center">
            <FileIcon filename={file.name} className="h-24 w-24 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-1">{file.name}</h2>
            <p className="text-sm text-muted-foreground mb-6">This is a compiled Java class file.</p>
            <Button onClick={handleDecompile} disabled={isLoading} size="lg" className="gap-2">
                {isLoading ? (
                    <LoaderCircle className="animate-spin" />
                ) : (
                    <BrainCircuit />
                )}
                <span>Decompile with AI</span>
            </Button>
            <p className="text-xs text-muted-foreground mt-4 max-w-sm">
                This will use an AI to simulate decompilation and generate plausible Java source code. The result may not be 100% accurate.
            </p>
        </div>
    );
}
