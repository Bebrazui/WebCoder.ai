"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import type { VFSFile } from '@/lib/vfs';
import { ScrollArea } from './ui/scroll-area';
import { dataURIToArrayBuffer } from '@/lib/utils';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface HexViewerProps {
  file: VFSFile;
}

const BYTES_PER_LINE = 16;

export function HexViewer({ file }: HexViewerProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const { buffer, error } = useMemo(() => {
    try {
      return { buffer: dataURIToArrayBuffer(file.content), error: null };
    } catch (e) {
      return { buffer: null, error: e instanceof Error ? e.message : 'Invalid data URI' };
    }
  }, [file.content]);

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
    while (element && viewerRef.current && !element.dataset.offset) {
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
  
  const handleMouseLeave = () => {
    setIsSelecting(false);
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

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (selectionStart === null || selectionEnd === null) return;
      
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);

      if (start === end && selectionStart !== null) { // if only one byte is selected
          const byte = new DataView(buffer!).getUint8(selectionStart);
          const hex = byte.toString(16).padStart(2, '0');
          event.clipboardData?.setData('text/plain', hex);
          event.preventDefault();
          return;
      }
      
      const selectedBytes = new Uint8Array(buffer!.slice(start, end + 1));
      const hexString = Array.from(selectedBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      
      event.clipboardData?.setData('text/plain', hexString);
      event.preventDefault();
    };

    const viewerElement = viewerRef.current;
    viewerElement?.addEventListener('copy', handleCopy);

    return () => {
        viewerElement?.removeEventListener('copy', handleCopy);
    };
  }, [selectionStart, selectionEnd, buffer]);
  
  if (error || !buffer) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-destructive">
        <h2 className="text-xl font-medium">Error loading binary data</h2>
        <p>{error}</p>
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
                <Button onClick={handleDownload} size="sm">Download</Button>
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
    </div>
  );
}
