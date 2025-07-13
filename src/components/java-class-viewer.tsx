// src/components/java-class-viewer.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { VFSFile } from '@/lib/vfs';
import { useVfs } from '@/hooks/use-vfs';
import Editor from "@monaco-editor/react";
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ServerCrash, Download, LoaderCircle } from 'lucide-react';
import { useAppState } from '@/hooks/use-app-state';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

interface JavaClassViewerProps {
  file: VFSFile;
}

export function JavaClassViewer({ file }: JavaClassViewerProps) {
  const { vfsRoot } = useVfs();
  const [disassembledCode, setDisassembledCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { editorSettings } = useAppState();
  const { toast } = useToast();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false };
  }, []);

  useEffect(() => {
    const disassemble = async () => {
      if (!isMounted.current) return;
      setIsLoading(true);
      setError(null);
      setDisassembledCode(null);
      
      try {
        const response = await fetch('/api/disassemble-java', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectRoot: vfsRoot,
            filePath: file.path,
          }),
        });
        
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "An unknown error occurred on the server.");
        }

        if(isMounted.current) {
          setDisassembledCode(data.disassembledCode);
        }
      } catch (err: any) {
        if(isMounted.current) {
            setError(err.message);
            console.error("Disassembly failed:", err);
        }
      } finally {
        if(isMounted.current) {
            setIsLoading(false);
        }
      }
    };

    disassemble();
  }, [file.path, vfsRoot, toast]);

  const handleDownload = () => {
    try {
        const link = document.createElement('a');
        link.href = file.content;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        toast({ variant: 'destructive', title: 'Download failed', description: 'Could not prepare the file for download.'})
        console.error("Download failed", e);
    }
  }

  return (
    <div className="flex h-full flex-col font-code text-sm">
       <div className="flex-shrink-0 border-b p-2">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">{file.name}</h3>
                    <p className="text-xs text-muted-foreground">Java Bytecode View (via javap)</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={handleDownload} size="sm" variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Download .class
                    </Button>
                 </div>
            </div>
       </div>
      <div className="flex-grow relative">
        {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
                <LoaderCircle className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Compiling and running javap on server...</p>
            </div>
        )}
        {error && (
            <div className="p-4">
                <Alert variant="destructive">
                    <ServerCrash className="h-4 w-4" />
                    <AlertTitle>Disassembly Failed</AlertTitle>
                    <AlertDescription>
                        <pre className="text-xs whitespace-pre-wrap font-mono">{error}</pre>
                    </AlertDescription>
                </Alert>
            </div>
        )}
        {!isLoading && !error && disassembledCode && (
          <Editor
            height="100%"
            language="java" // Close enough for bytecode highlighting
            value={disassembledCode}
            theme={editorSettings.theme === 'oceanic' ? 'oceanic' : 'vs-dark'}
            options={{
              readOnly: true,
              fontFamily: editorSettings.fontFamily,
              fontSize: editorSettings.fontSize,
              wordWrap: editorSettings.wordWrap ? "on" : "off",
              minimap: { enabled: true },
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        )}
      </div>
    </div>
  );
}
