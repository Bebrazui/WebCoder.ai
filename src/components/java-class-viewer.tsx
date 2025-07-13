"use client";

import React, { useMemo, useState, useCallback } from 'react';
import type { VFSFile } from '@/lib/vfs';
import { ScrollArea } from './ui/scroll-area';
import { dataURIToArrayBuffer } from '@/lib/utils';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Download, FileQuestion, WandSparkles, LoaderCircle } from 'lucide-react';
import { inspectBinaryData } from '@/ai/flows/inspect-binary-data';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import ReactMarkdown from 'react-markdown';
import { Skeleton } from './ui/skeleton';

interface JavaClassViewerProps {
  file: VFSFile;
}

const BYTES_PER_LINE = 16;

function bufferToHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
}


export function JavaClassViewer({ file }: JavaClassViewerProps) {
  const [isInspecting, setIsInspecting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { buffer, error } = useMemo(() => {
    try {
      if (!file.content) return { buffer: new ArrayBuffer(0), error: null };
      return { buffer: dataURIToArrayBuffer(file.content), error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid data URI';
      console.error(`Failed to parse data URI for ${file.name}:`, msg);
      return { buffer: null, error: msg };
    }
  }, [file.content, file.name]);

  const lines = useMemo(() => {
    if (!buffer) return [];
    
    const dataView = new DataView(buffer);
    const result = [];

    for (let offset = 0; offset < dataView.byteLength; offset += BYTES_PER_LINE) {
        const address = offset.toString(16).padStart(8, '0').toUpperCase();
        const hexParts = [];
        const asciiParts = [];

        for (let i = 0; i < BYTES_PER_LINE; i++) {
            if (offset + i < dataView.byteLength) {
                const byte = dataView.getUint8(offset + i);
                hexParts.push(byte.toString(16).padStart(2, '0').toUpperCase());
                asciiParts.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
            } else {
                hexParts.push('  ');
                asciiParts.push(' ');
            }
        }
        result.push({ address, hex: hexParts, ascii: asciiParts });
    }
    return result;

  }, [buffer]);

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
        toast({ variant: 'destructive', title: 'Download Failed' });
    }
  }

  const handleInspect = useCallback(async () => {
    if (!buffer) {
        toast({ variant: 'destructive', title: 'Error', description: 'No data to analyze.' });
        return;
    }
    setIsInspecting(true);
    setAnalysisResult(null);
    try {
        const hexData = bufferToHex(buffer.slice(0, 4096)); // Limit to first 4KB for performance
        const result = await inspectBinaryData({
            hexData,
            context: `This is a Java .class file named ${file.name}. Please analyze the bytecode structure. Identify the magic number, version, constant pool, fields, and methods if possible.`
        });
        setAnalysisResult(result.analysis);
    } catch (error) {
        console.error('AI inspection failed:', error);
        toast({ variant: 'destructive', title: 'Analysis Failed', description: 'The AI could not analyze the file.' });
    } finally {
        setIsInspecting(false);
    }
  }, [buffer, file.name, toast]);
  
  if (error || !buffer) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-destructive">
        <FileQuestion className="h-16 w-16 mb-4" />
        <h2 className="text-xl font-medium">Error loading binary data</h2>
        <p>Could not display file: {file.name}</p>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col font-code text-sm">
       <div className="flex-shrink-0 border-b p-2">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">{file.name} <Badge variant="outline">Java Bytecode</Badge></h3>
                    <p className="text-xs text-muted-foreground">{buffer.byteLength.toLocaleString()} bytes</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={handleInspect} size="sm" variant="outline" disabled={isInspecting}>
                        {isInspecting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                        Analyze with AI
                    </Button>
                    <Button onClick={handleDownload} size="sm" variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                 </div>
            </div>
       </div>
      <div className="flex-grow flex h-[calc(100%-60px)]">
        <ScrollArea className="flex-grow w-1/2 h-full">
            <div className="p-4">
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-4">
                {/* Header */}
                <div className="font-semibold text-muted-foreground sticky top-0 bg-background z-10">Offset</div>
                <div className="font-semibold text-muted-foreground sticky top-0 bg-background z-10">Hexadecimal</div>
                <div className="font-semibold text-muted-foreground sticky top-0 bg-background z-10">ASCII</div>
                
                {/* Data */}
                {lines.map((line, lineIndex) => (
                <React.Fragment key={line.address}>
                    <div className="text-muted-foreground">{line.address}</div>
                    <div className="flex space-x-1">
                        {line.hex.map((hex, byteIndex) => (
                            <span key={byteIndex} >{hex}</span>
                        ))}
                    </div>
                    <div className="flex text-muted-foreground">
                        {line.ascii.map((char, byteIndex) => (
                            <span key={byteIndex}>{char}</span>
                        ))}
                    </div>
                </React.Fragment>
                ))}
            </div>
            </div>
        </ScrollArea>
        <div className="w-1/2 h-full border-l">
            <ScrollArea className="h-full">
                <div className="p-4 prose dark:prose-invert prose-sm max-w-none">
                    {isInspecting && (
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                             <Skeleton className="h-4 w-full" />
                        </div>
                    )}
                    {analysisResult ? (
                         <ReactMarkdown>{analysisResult}</ReactMarkdown>
                    ) : !isInspecting && (
                        <div className="text-muted-foreground text-center pt-10">
                            <p>Click "Analyze with AI" to decompile and explain this .class file.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
      </div>
    </div>
  );
}
