// src/components/title-bar.tsx
"use client";

import { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

// Расширяем интерфейс Window для работы с нашим API Electron
declare global {
  interface Window {
    electronAPI: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      onIsMaximized: (callback: (isMaximized: boolean) => void) => void;
    }
  }
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Подписываемся на события изменения состояния окна
    window.electronAPI?.onIsMaximized(setIsMaximized);
  }, []);

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <div className="draggable h-10 bg-background/80 backdrop-blur-sm flex items-center justify-between pl-20 pr-1 border-b border-border/50">
      <div className="text-sm text-muted-foreground">WebCoder.ai</div>
      <div className="flex items-center no-drag">
        <button onClick={handleMinimize} className="p-2 hover:bg-muted/50 rounded-md">
          <Minus className="h-4 w-4" />
        </button>
        <button onClick={handleMaximize} className="p-2 hover:bg-muted/50 rounded-md">
          {isMaximized ? <Copy className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
        <button onClick={handleClose} className="p-2 hover:bg-destructive/80 rounded-md">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}