"use client";

import React, { useMemo } from 'react';
import type { VFSFile } from '@/lib/vfs';
import { ScrollArea } from './ui/scroll-area';
import { dataURIToArrayBuffer } from '@/lib/utils';
import { Button } from './ui/button';

interface HexViewerProps {
  file: VFSFile;
}

const BYTES_PER_LINE = 16;

export function HexViewer({ file }: HexViewerProps) {
  const { buffer, error } = useMemo(() => {
    try {
      return { buffer: dataURIToArrayBuffer(file.content), error: null };
    } catch (e) {
      return { buffer: null, error: e instanceof Error ? e.message : 'Invalid data URI' };
    }
  }, [file.content]);

  if (error || !buffer) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-destructive">
        <h2 className="text-xl font-medium">Error loading binary data</h2>
        <p>{error}</p>
      </div>
    );
  }

  const dataView = new DataView(buffer);
  const lines = [];

  for (let offset = 0; offset < dataView.byteLength; offset += BYTES_PER_LINE) {
    const address = offset.toString(16).padStart(8, '0');
    const hexParts = [];
    const asciiParts = [];

    for (let i = 0; i < BYTES_PER_LINE; i++) {
      if (offset + i < dataView.byteLength) {
        const byte = dataView.getUint8(offset + i);
        hexParts.push(byte.toString(16).padStart(2, '0'));
        // Replace non-printable characters with a dot
        asciiParts.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
      } else {
        hexParts.push('  ');
        asciiParts.push(' ');
      }
    }
    lines.push({ address, hex: hexParts.join(' '), ascii: asciiParts.join('') });
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

  return (
    <div className="flex h-full flex-col font-code text-sm">
       <div className="flex-shrink-0 border-b p-2">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">{file.name}</h3>
                    <p className="text-xs text-muted-foreground">{buffer.byteLength.toLocaleString()} bytes</p>
                </div>
                <Button onClick={handleDownload} size="sm">Download</Button>
            </div>
       </div>
      <ScrollArea className="flex-grow">
        <div className="p-4 select-none">
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-4">
            {/* Header */}
            <div className="font-semibold text-muted-foreground">Offset</div>
            <div className="font-semibold text-muted-foreground">Hexadecimal</div>
            <div className="font-semibold text-muted-foreground">ASCII</div>
            
            {/* Data */}
            {lines.map((line) => (
              <React.Fragment key={line.address}>
                <div className="text-muted-foreground">{line.address}</div>
                <div>{line.hex}</div>
                <div className="text-muted-foreground">{line.ascii}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
