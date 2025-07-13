"use client";

import React, { useMemo } from 'react';
import type { VFSFile } from '@/lib/vfs';
import { ScrollArea } from './ui/scroll-area';
import { dataURIToArrayBuffer } from '@/lib/utils';
import { Button } from './ui/button';
import { Download, FileQuestion } from 'lucide-react';

interface HexViewerProps {
  file: VFSFile;
}

const BYTES_PER_LINE = 16;

export function HexViewer({ file }: HexViewerProps) {
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
    }
  }
  
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
                    <h3 className="font-semibold">{file.name}</h3>
                    <p className="text-xs text-muted-foreground">{buffer.byteLength.toLocaleString()} bytes</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={handleDownload} size="sm" variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                 </div>
            </div>
       </div>
      <ScrollArea className="flex-grow">
        <div className="p-4">
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-4">
            {/* Header */}
            <div className="font-semibold text-muted-foreground sticky top-0 bg-background z-10">Offset</div>
            <div className="font-semibold text-muted-foreground sticky top-0 bg-background z-10">Hexadecimal</div>
            <div className="font-semibold text-muted-foreground sticky top-0 bg-background z-10">ASCII</div>
            
            {/* Data */}
            {lines.map((line) => (
              <React.Fragment key={line.address}>
                <div className="text-muted-foreground">{line.address}</div>
                <div className="flex space-x-1">
                    {line.hex.map((hex, byteIndex) => (
                        <span key={byteIndex}>{hex}</span>
                    ))}
                </div>
                <div className="text-muted-foreground">
                    {line.ascii.join('')}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
