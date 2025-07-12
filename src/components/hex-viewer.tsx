"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import type { VFSFile } from '@/lib/vfs';
import { ScrollArea } from './ui/scroll-area';
import { dataURIToArrayBuffer } from '@/lib/utils';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { LoaderCircle, Sparkles, Download, FileQuestion } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { inspectBinaryData } from '@/ai/flows/inspect-binary-data';
import { useToast } from '@/hooks/use-toast';

interface HexViewerProps {
  file: VFSFile;
}

const BYTES_PER_LINE = 16;

const AIAnalysisDialog = ({ open, onOpenChange, hexData, context, analysisResult, isLoading }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    hexData: string;
    context: string;
    analysisResult: string | null;
    isLoading: boolean;
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>AI Hex Inspector Analysis</DialogTitle>
                    <DialogDescription>
                        The AI has analyzed the selected binary data.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div>
                        <h3 className="font-semibold text-sm mb-1">Selected Hex Data:</h3>
                        <pre className="p-2 bg-muted rounded-md text-xs max-h-24 overflow-auto font-code">
                            <code>{hexData.match(/.{1,2}/g)?.join(' ')}</code>
                        </pre>
                    </div>
                     <div>
                        <h3 className="font-semibold text-sm mb-1">Context:</h3>
                        <p className="text-sm text-muted-foreground">{context}</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm mb-1">AI Analysis:</h3>
                         {isLoading ? (
                            <div className="flex items-center gap-2">
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                <span>Analyzing...</span>
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <p>{analysisResult || "No analysis available."}</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};


export function HexViewer({ file }: HexViewerProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isAIAnalysisOpen, setIsAIAnalysisOpen] = useState(false);
  const [isAIAnalysisLoading, setIsAIAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAIAnalysisResult] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { buffer, error } = useMemo(() => {
    try {
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
        const address = offset.toString(16).padStart(8, '0');
        const hexParts = [];
        const asciiParts = [];

        for (let i = 0; i < BYTES_PER_LINE; i++) {
            if (offset + i < dataView.byteLength) {
                const byte = dataView.getUint8(offset + i);
                hexParts.push(byte.toString(16).padStart(2, '0'));
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

  const getByteOffsetFromElement = (element: HTMLElement | null): number | null => {
    while (element && viewerRef.current && element !== viewerRef.current && !element.dataset.offset) {
      element = element.parentElement;
    }
    return element?.dataset.offset ? parseInt(element.dataset.offset, 10) : null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const offset = getByteOffsetFromElement(e.target as HTMLElement);
    if (offset !== null) {
      e.preventDefault();
      setIsSelecting(true);
      setSelectionStart(offset);
      setSelectionEnd(offset);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSelecting) {
      const offset = getByteOffsetFromElement(e.target as HTMLElement);
      if (offset !== null) {
        setSelectionEnd(offset);
      }
    }
  };
  
  const handleMouseUp = () => {
    setIsSelecting(false);
  };
  
  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSelecting && e.relatedTarget && !viewerRef.current?.contains(e.relatedTarget as Node)) {
        setIsSelecting(false);
    }
  }

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

  const selectedHexData = useMemo(() => {
    if (selectionStart === null || selectionEnd === null || !buffer) return '';
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const selectedBytes = new Uint8Array(buffer.slice(start, end + 1));
    return Array.from(selectedBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }, [selectionStart, selectionEnd, buffer]);
  
  const handleInspect = async () => {
    if (!selectedHexData) return;
    setIsAIAnalysisOpen(true);
    setIsAIAnalysisLoading(true);
    setAIAnalysisResult(null);

    try {
        const result = await inspectBinaryData({
            hexData: selectedHexData,
            context: `This data comes from a file named "${file.name}".`
        });
        setAIAnalysisResult(result.analysis);
    } catch(e) {
        console.error("AI Analysis failed:", e);
        toast({ variant: "destructive", title: "AI Analysis Failed", description: "Could not analyze the data." });
        setAIAnalysisResult("The AI analysis failed. Please try again.");
    } finally {
        setIsAIAnalysisLoading(false);
    }
  };

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (selectedHexData) {
        event.clipboardData?.setData('text/plain', selectedHexData.match(/.{1,2}/g)?.join(' ') || '');
        event.preventDefault();
      }
    };

    const viewerElement = viewerRef.current;
    viewerElement?.addEventListener('copy', handleCopy);

    return () => {
        viewerElement?.removeEventListener('copy', handleCopy);
    };
  }, [selectedHexData]);
  
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

  const isSelected = (offset: number) => {
    if (selectionStart === null || selectionEnd === null) return false;
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    return offset >= start && offset <= end;
  };

  return (
    <div className="flex h-full flex-col font-code text-sm select-none">
       <div className="flex-shrink-0 border-b p-2">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">{file.name}</h3>
                    <p className="text-xs text-muted-foreground">{buffer.byteLength.toLocaleString()} bytes</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={handleDownload} size="sm" variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                    <Button onClick={handleInspect} size="sm" disabled={!selectedHexData}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Inspect with AI
                    </Button>
                 </div>
            </div>
       </div>
      <ScrollArea className="flex-grow">
        <div 
          ref={viewerRef} 
          className="p-4"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
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
                    {line.hex.map((hex, byteIndex) => {
                        const offset = lineIndex * BYTES_PER_LINE + byteIndex;
                        return (
                            <span 
                                key={byteIndex} 
                                data-offset={offset}
                                className={cn(
                                    "px-0.5 rounded-sm",
                                    offset < buffer.byteLength && 'cursor-pointer',
                                    isSelected(offset) && "bg-blue-600 text-white"
                                )}
                            >
                                {hex}
                            </span>
                        )
                    })}
                </div>
                <div className="flex">
                    {line.ascii.map((char, byteIndex) => {
                         const offset = lineIndex * BYTES_PER_LINE + byteIndex;
                         return (
                            <span 
                                key={byteIndex}
                                data-offset={offset}
                                className={cn(
                                    "px-0.5 rounded-sm",
                                     offset < buffer.byteLength && 'cursor-pointer',
                                    isSelected(offset) ? "bg-blue-600 text-white" : "text-muted-foreground"
                                )}
                            >
                                {char}
                            </span>
                         )
                    })}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </ScrollArea>
       <AIAnalysisDialog 
            open={isAIAnalysisOpen}
            onOpenChange={setIsAIAnalysisOpen}
            hexData={selectedHexData}
            context={`This data comes from a file named "${file.name}".`}
            analysisResult={aiAnalysisResult}
            isLoading={isAIAnalysisLoading}
       />
    </div>
  );
}
