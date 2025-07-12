
"use client";

import React from 'react';
import type * as monaco from 'monaco-editor';
import {
  File, FunctionSquare, Building2, Variable, Box, ListOrdered, Library, BookKey
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

export interface OutlineData {
  name: string;
  kind: monaco.languages.SymbolKind;
  range: monaco.IRange;
  children: OutlineData[];
}

interface OutlineViewProps {
  symbols: OutlineData[];
  onSymbolSelect: (range: monaco.IRange) => void;
}

const InterfaceIcon = (props: React.ComponentProps<'svg'>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M9 12h6" />
    </svg>
  );

const symbolKindToIcon: Record<monaco.languages.SymbolKind, React.ReactNode> = {
  [0]: <File className="h-4 w-4" />, // File
  [1]: <Library className="h-4 w-4 text-blue-400" />, // Module
  [2]: <Library className="h-4 w-4 text-blue-400" />, // Namespace
  [3]: <Library className="h-4 w-4 text-blue-400" />, // Package
  [4]: <Building2 className="h-4 w-4 text-amber-400" />, // Class
  [5]: <FunctionSquare className="h-4 w-4 text-purple-400" />, // Method
  [6]: <BookKey className="h-4 w-4 text-teal-400" />, // Property
  [7]: <BookKey className="h-4 w-4 text-teal-400" />, // Field
  [8]: <FunctionSquare className="h-4 w-4 text-purple-400" />, // Constructor
  [9]: <ListOrdered className="h-4 w-4 text-amber-400" />, // Enum
  [10]: <InterfaceIcon className="h-4 w-4 text-cyan-400" />, // Interface
  [11]: <FunctionSquare className="h-4 w-4 text-purple-400" />, // Function
  [12]: <Variable className="h-4 w-4 text-sky-400" />, // Variable
  [13]: <Variable className="h-4 w-4 text-sky-400" />, // Constant
  [14]: <Variable className="h-4 w-4 text-sky-400" />, // String
  [15]: <Variable className="h-4 w-4 text-sky-400" />, // Number
  [16]: <Variable className="h-4 w-4 text-sky-400" />, // Boolean
  [17]: <Variable className="h-4 w-4 text-sky-400" />, // Array
  [18]: <Variable className="h-4 w-4 text-sky-400" />, // Object
  [19]: <Variable className="h-4 w-4 text-sky-400" />, // Key
  [20]: <Variable className="h-4 w-4 text-sky-400" />, // Null
  [21]: <Variable className="h-4 w-4 text-teal-400" />, // EnumMember
  [22]: <Box className="h-4 w-4 text-amber-400" />, // Struct
  [23]: <Variable className="h-4 w-4 text-sky-400" />, // Event
  [24]: <Variable className="h-4 w-4 text-sky-400" />, // Operator
  [25]: <Variable className="h-4 w-4 text-sky-400" />, // TypeParameter
};

const SymbolNode: React.FC<{ symbol: OutlineData; level: number; onSymbolSelect: (range: monaco.IRange) => void }> = ({ symbol, level, onSymbolSelect }) => (
  <div>
    <div
      onClick={() => onSymbolSelect(symbol.range)}
      className="flex items-center gap-2 p-1 rounded-md cursor-pointer hover:bg-accent"
      style={{ paddingLeft: `${level * 1}rem` }}
    >
      {symbolKindToIcon[symbol.kind] || <File className="h-4 w-4" />}
      <span className="truncate">{symbol.name}</span>
    </div>
    {symbol.children && symbol.children.length > 0 && (
      <div>
        {symbol.children.sort((a,b) => a.range.startLineNumber - b.range.startLineNumber).map((child, index) => (
          <SymbolNode key={`${child.name}-${index}`} symbol={child} level={level + 1} onSymbolSelect={onSymbolSelect} />
        ))}
      </div>
    )}
  </div>
);


export function OutlineView({ symbols, onSymbolSelect }: OutlineViewProps) {
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold">Outline</h2>
      </div>
      <ScrollArea className="flex-grow">
        <div className="p-2 text-sm">
          {symbols.length > 0 ? (
            symbols.sort((a,b) => a.range.startLineNumber - b.range.startLineNumber).map((symbol, index) => (
              <SymbolNode key={`${symbol.name}-${index}`} symbol={symbol} level={0} onSymbolSelect={onSymbolSelect} />
            ))
          ) : (
            <div className="text-muted-foreground p-4 text-center">
              No symbols found in this file, or the language is not supported for outline.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
