
"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CodeEditor } from "./code-editor";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import type { VFSFile } from "@/lib/vfs";
import { X, Code, Image as ImageIcon, FileQuestion, Save, Database, FileAudio } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from 'next/image';
import { Button } from "./ui/button";
import { HexViewer } from "./hex-viewer";

interface EditorPaneProps {
  openFiles: VFSFile[];
  activeFilePath: string | null;
  dirtyFiles: Set<string>;
  onFileSelect: (path: string) => void;
  onFileChange: (path: string, newContent: string) => void;
  onFileClose: (path: string) => void;
  onFileSave: (path: string) => void;
}

type ViewMode = "code" | "hex" | "picker";

const isImageFile = (path: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(path);
}

const isAudioFile = (path: string) => {
    return /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(path);
}

const isPotentiallyBinary = (file: VFSFile) => {
    // Explicitly handle .class files as binary
    if (/\.class$/i.test(file.path)) {
        return true;
    }

    if (file.content.startsWith('data:')) {
        const mime = file.content.substring(5, file.content.indexOf(';'));
        // Treat audio as its own category, not binary for the picker
        return !mime.startsWith('text/') && !mime.startsWith('image/') && !mime.startsWith('audio/');
    }
    // Simple heuristic for text files without data URI
    // This is imperfect but prevents trying to render huge binary files as text
    if (file.content.length > 1000000 && !/\.(txt|md|json|xml|html|css|js|ts|jsx|tsx|py|java|c|cpp|h|hpp|cs|go|php|rb|rs|swift|kt|yml|yaml)$/i.test(file.path)) {
       return true;
    }
    // Check for null bytes in the first 1024 chars, a strong indicator of binary
    for (let i = 0; i < Math.min(file.content.length, 1024); i++) {
        if (file.content.charCodeAt(i) === 0) {
            return true;
        }
    }
    return false;
};


const UnsupportedFileViewer = ({ file, onSelectView }: { file: VFSFile, onSelectView: (mode: ViewMode) => void }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
            <FileQuestion className="h-16 w-16 mb-4" />
            <h2 className="text-xl font-medium font-headline mb-2">Unsupported File Type</h2>
            <p className="mb-4">How would you like to open <span className="font-semibold">{file.name}</span>?</p>
            <div className="flex gap-4">
                <Button onClick={() => onSelectView('code')}>Open as Text</Button>
                <Button variant="secondary" onClick={() => onSelectView('hex')}>Open in Hex Viewer</Button>
            </div>
        </div>
    )
}

const AudioPlayer = ({ file }: { file: VFSFile }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-muted/20 p-4">
            <div className="w-full max-w-md text-center">
                <FileAudio className="h-24 w-24 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">{file.name}</h3>
                <audio controls src={file.content} className="w-full">
                    Your browser does not support the audio element.
                </audio>
            </div>
        </div>
    );
};

const getFileIcon = (file: VFSFile, viewMode?: ViewMode) => {
    if (isImageFile(file.path)) return <ImageIcon className="h-4 w-4" />;
    if (isAudioFile(file.path)) return <FileAudio className="h-4 w-4" />;
    if (viewMode === 'hex' || (viewMode !== 'code' && isPotentiallyBinary(file))) {
        return <Database className="h-4 w-4" />;
    }
    return <Code className="h-4 w-4" />;
}


export function EditorPane({
  openFiles,
  activeFilePath,
  dirtyFiles,
  onFileSelect,
  onFileChange,
  onFileClose,
  onFileSave,
}: EditorPaneProps) {
  const [viewModes, setViewModes] = useState<Record<string, ViewMode>>({});

  const setViewModeForFile = (path: string, mode: ViewMode) => {
    setViewModes(prev => ({ ...prev, [path]: mode }));
  };

  if (openFiles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground bg-background p-4">
        <Code className="h-16 w-16 mb-4" />
        <h2 className="text-xl font-medium font-headline">Welcome to WebCoder.ai</h2>
        <p>Select a file from the explorer to begin editing.</p>
        <p className="text-xs mt-2">Right-click in the explorer to create files or folders.</p>
      </div>
    );
  }

  const renderFileContent = (file: VFSFile) => {
    const viewMode = viewModes[file.path] || 'picker';

    if (isImageFile(file.path)) {
        return <div className="relative h-full w-full flex items-center justify-center bg-muted/20 p-4">
            <Image src={file.content} alt={file.name} layout="fill" objectFit="contain" />
        </div>
    }

    if (isAudioFile(file.path)) {
        return <AudioPlayer file={file} />;
    }

    if (isPotentiallyBinary(file) && viewMode === 'picker') {
        return <UnsupportedFileViewer file={file} onSelectView={(mode) => setViewModeForFile(file.path, mode)} />;
    }
    
    if (viewMode === 'hex') {
        return <HexViewer file={file} />;
    }

    // Default to code editor (includes 'code' mode and files that aren't potentially binary)
    return <CodeEditor
        path={file.path}
        value={file.content}
        onChange={(newContent) => onFileChange(file.path, newContent)}
    />
  }

  return (
    <Tabs
      value={activeFilePath || ""}
      onValueChange={(path) => {
        const file = openFiles.find(f => f.path === path);
        if (file && !viewModes[path] && !isImageFile(path) && !isAudioFile(path) && !isPotentiallyBinary(file)) {
          setViewModeForFile(path, 'code');
        }
        onFileSelect(path);
      }}
      className="flex flex-col h-full bg-background"
    >
      <div className="flex-shrink-0">
        <ScrollArea className="w-full">
          <TabsList className="bg-transparent p-0 m-0 gap-1 pl-2">
            {openFiles.map((file) => {
              const isDirty = dirtyFiles.has(file.path);
              return (
                <TabsTrigger
                  key={file.path}
                  value={file.path}
                  className={cn(
                    "flex items-center gap-2 pr-1 rounded-none rounded-t-md border-b-0 data-[state=inactive]:bg-muted/50 data-[state=inactive]:hover:bg-muted data-[state=active]:bg-background",
                  )}
                >
                  {getFileIcon(file, viewModes[file.path])}
                  <span>{file.name}</span>
                  {isDirty && (
                      <div className="flex items-center gap-1 ml-1">
                          <div
                              onClick={(e) => {
                                  e.stopPropagation();
                                  onFileSave(file.path);
                              }}
                              className="p-0.5 rounded-sm hover:bg-accent cursor-pointer"
                              aria-label={`Save ${file.name}`}
                              role="button"
                          >
                              <Save className="h-3 w-3 text-blue-500" />
                          </div>
                          <div className="h-2 w-2 rounded-full bg-blue-500" title="Unsaved changes"></div>
                      </div>
                  )}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileClose(file.path);
                    }}
                    className="p-0.5 rounded-sm hover:bg-destructive/80 ml-1 cursor-pointer"
                    aria-label={`Close ${file.name}`}
                    role="button"
                  >
                    <X className="h-3 w-3" />
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
      <div className="flex-grow bg-background rounded-b-md overflow-hidden">
        {openFiles.map((file) => (
          <TabsContent
            key={file.path}
            value={file.path}
            className="h-full mt-0"
          >
             {renderFileContent(file)}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
