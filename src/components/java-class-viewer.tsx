// src/components/java-class-viewer.tsx
"use client";

import React, { useState, useEffect } from 'react';
import type { VFSFile } from '@/lib/vfs';
import { useVfs } from '@/hooks/use-vfs';
import Editor from "@monaco-editor/react";
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ServerCrash, Binary, Download } from 'lucide-react';
import { useAppState } from '@/hooks/use-app-state';
import { Button } from './ui/button';

interface JavaClassViewerProps {
  file: VFSFile;
}

export function JavaClassViewer({ file }: JavaClassViewerProps) {
  const { vfsRoot } = useVfs();
  const [disassembledCode, setDisassembledCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { editorSettings } = useAppState();

  useEffect(() => {
    const disassemble = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/disassemble-java', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Pass the entire project structure
            projectFiles: [vfsRoot],
            classFilePath: file.path,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to disassemble the class file.');
        }

        setDisassembledCode(data.disassembledCode);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    disassemble();
  }, [file, vfsRoot]);

  const handleDownload = () => {
    try {
        const link = document.createElement('a');
        link.href = file.content;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
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
        {isLoading && <Skeleton className="absolute inset-0" />}
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
