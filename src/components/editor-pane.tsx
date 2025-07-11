"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CodeEditor } from "./code-editor";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import type { VFSFile } from "@/lib/vfs";
import { X, Code, Image as ImageIcon, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from 'next/image';
import { Button } from "./ui/button";

interface EditorPaneProps {
  openFiles: VFSFile[];
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileChange: (path: string, newContent: string) => void;
  onFileClose: (path: string) => void;
}

const isImageFile = (path: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(path);
}

const isKnownTextFile = (path: string) => {
    const lang = getLanguage(path);
    return lang !== 'plaintext' || path.endsWith('.txt') || path.endsWith('.md');
}

// Helper to get language for text files
const getLanguage = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'js':
        case 'jsx':
            return 'javascript';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'json':
            return 'json';
        case 'css':
            return 'css';
        case 'html':
            return 'html';
        case 'md':
            return 'markdown';
        case 'py':
            return 'python';
        case 'java':
            return 'java';
        case 'c':
        case 'h':
            return 'c';
        case 'cpp':
        case 'hpp':
            return 'cpp';
        case 'cs':
            return 'csharp';
        case 'go':
            return 'go';
        case 'php':
            return 'php';
        case 'rb':
            return 'ruby';
        case 'rs':
            return 'rust';
        case 'swift':
            return 'swift';
        case 'kt':
            return 'kotlin';
        case 'yaml':
        case 'yml':
            return 'yaml';
        default:
            return 'plaintext';
    }
}

const UnsupportedFileViewer = ({ file }: { file: VFSFile }) => {
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = file.content; // Assumes content is a data URI
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
            <FileQuestion className="h-16 w-16 mb-4" />
            <h2 className="text-xl font-medium font-headline mb-2">Unsupported File Type</h2>
            <p className="mb-4">Cannot display <span className="font-semibold">{file.name}</span> in the editor.</p>
            <Button onClick={handleDownload}>Download File</Button>
        </div>
    )
}

export function EditorPane({
  openFiles,
  activeFilePath,
  onFileSelect,
  onFileChange,
  onFileClose,
}: EditorPaneProps) {
  if (openFiles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
        <Code className="h-16 w-16 mb-4" />
        <h2 className="text-xl font-medium font-headline">Welcome to WebCoder.ai</h2>
        <p>Select a file from the explorer to begin editing.</p>
        <p className="text-xs mt-2">You can upload files or a .zip archive to get started.</p>
      </div>
    );
  }
  return (
    <Tabs
      value={activeFilePath || ""}
      onValueChange={onFileSelect}
      className="flex flex-col h-full"
    >
      <ScrollArea className="w-full">
        <TabsList className="bg-transparent p-0 m-0 gap-1">
          {openFiles.map((file) => (
            <TabsTrigger
              key={file.path}
              value={file.path}
              className={cn(
                "flex items-center gap-2 pr-1 rounded-none rounded-t-md border-b-0 data-[state=inactive]:bg-muted/50 data-[state=inactive]:hover:bg-muted data-[state=active]:bg-background",
              )}
            >
              {isImageFile(file.name) ? <ImageIcon className="h-4 w-4" /> : <Code className="h-4 w-4" />}
              <span>{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileClose(file.path);
                }}
                className="p-0.5 rounded-sm hover:bg-destructive/80"
                aria-label={`Close ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="flex-grow bg-background rounded-b-md rounded-tr-md overflow-hidden">
        {openFiles.map((file) => (
          <TabsContent
            key={file.path}
            value={file.path}
            className="h-full mt-0"
          >
             {isImageFile(file.path) ? (
                <div className="relative h-full w-full flex items-center justify-center bg-muted/20 p-4">
                    <Image src={file.content} alt={file.name} layout="fill" objectFit="contain" />
                </div>
             ) : isKnownTextFile(file.path) ? (
                <CodeEditor
                    path={file.path}
                    value={file.content}
                    onChange={(newContent) => onFileChange(file.path, newContent)}
                />
             ) : (
                <UnsupportedFileViewer file={file} />
             )}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
