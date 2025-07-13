// src/components/java-class-viewer.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { VFSFile, VFSDirectory, VFSNode } from '@/lib/vfs';
import { useVfs } from '@/hooks/use-vfs';
import Editor from "@monaco-editor/react";
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ServerCrash, Binary, Download, LoaderCircle } from 'lucide-react';
import { useAppState } from '@/hooks/use-app-state';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

interface JavaClassViewerProps {
  file: VFSFile;
}

declare global {
  interface Window {
    cheerpjInit: (options?: any) => Promise<void>;
    cheerpjRunMain: (mainClass: string, ...args: string[]) => Promise<number>;
    cheerpjCreateDisplay: (width: number, height: number, parent: HTMLElement) => void;
  }
}

const loadCheerpjScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.getElementById('cheerpj-loader-script')) {
      const waitForCJ = setInterval(() => {
        if (window.cheerpjInit) {
          clearInterval(waitForCJ);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = 'cheerpj-loader-script';
    script.src = 'https://cjrtnc.leaningtech.com/3.0/loader.js';
    script.async = true;
    
    script.onload = () => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (window.cheerpjInit) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startTime > 20000) { // 20-second timeout
          clearInterval(interval);
          reject(new Error('CheerpJ script loaded, but initialization timed out.'));
        }
      }, 100);
    };

    script.onerror = () => {
      reject(new Error('Failed to load the CheerpJ script. Check network connection.'));
    };

    document.head.appendChild(script);
  });
};

const setupCheerpjVfs = async (vfsRoot: VFSDirectory): Promise<string> => {
    const classPaths: Set<string> = new Set();
    const basePath = `/app/`;

    const traverse = (node: VFSNode, currentPath: string) => {
        if (node.type === 'directory') {
            node.children.forEach(child => traverse(child, `${currentPath}${node.name}/`));
            if (node.children.some(c => c.name.endsWith('.class'))) {
                // Heuristic: if a directory contains class files, it's part of the classpath.
                // This will need refinement for complex project structures.
                const classPathEntry = `${basePath}${currentPath}${node.name}`;
                classPaths.add(classPathEntry);
            }
        }
    };
    traverse(vfsRoot, '');

    // Add root as a fallback classpath
    classPaths.add(basePath + vfsRoot.name);

    await window.cheerpjInit({
        mounts: [{
            type: "vfs",
            fs: vfsRoot,
            mountPoint: basePath
        }],
        // Use a heuristic for classpath. This might need user configuration for complex projects.
        classPath: Array.from(classPaths),
    });
    
    return `${basePath}${vfsRoot.name}${file.path}`;
};


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
    let cheerpjStdout = '';
    let cheerpjStderr = '';

    const disassemble = async () => {
      if (!isMounted.current) return;
      setIsLoading(true);
      setError(null);
      setDisassembledCode(null);
      
      try {
        await loadCheerpjScript();
        if (!isMounted.current) return;

        // Path inside CheerpJ's VFS
        const cheerpjFilePath = `/app${file.path}`;
        
        // Convert class path to qualified class name
        // This is a heuristic and may fail on complex structures.
        // e.g., /Project/com/example/MyClass.class -> com.example.MyClass
        let qualifiedClassName = file.path
            .substring(file.path.indexOf('/', 1) + 1) // Remove project root folder
            .replace(/\.class$/, '')
            .replace(/\//g, '.');

        await window.cheerpjInit({
            // Redirect stdout/stderr to capture javap's output
                    stdout: (str: string) => { cheerpjStdout += str + "\n"; },
                    stderr: (str: string) => { cheerpjStderr += str + "\n"; },
        });

        if (!isMounted.current) return;
        
        await window.cheerpjRunMain("com.sun.tools.javap.Main", "-c", qualifiedClassName);

        if (!isMounted.current) return;

        if (cheerpjStderr && !cheerpjStdout) {
            throw new Error(cheerpjStderr);
        }

        setDisassembledCode(cheerpjStdout);

      } catch (err: any) {
        if(isMounted.current) {
            setError(err.message || "An unknown error occurred during disassembly.");
            console.error(err);
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
        console.error("Download failed", e);
    }
  }

  return (
    <div className="flex h-full flex-col font-code text-sm">
       <div className="flex-shrink-0 border-b p-2">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">{file.name}</h3>
                    <p className="text-xs text-muted-foreground">Java Bytecode View (via CheerpJ/javap)</p>
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
                <p className="text-muted-foreground">Loading CheerpJ & running javap...</p>
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
