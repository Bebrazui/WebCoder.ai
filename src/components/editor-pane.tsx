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
import { X, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from 'next/image';
import { HexViewer } from "./hex-viewer";
import { FileIcon } from "./file-icon";
import type * as monaco from "monaco-editor";
import { OutlineData } from "./outline-view";
import { isTextFile, isImageFile, isAudioFile, isJavaClassFile } from "@/lib/vfs";
import { JavaClassViewer } from "./java-class-viewer";

interface EditorPaneProps {
  openFiles: VFSFile[];
  activeFilePath: string | null;
  dirtyFiles: Set<string>;
  onFileSelect: (path: string) => void;
  onFileChange: (path: string, newContent: string) => void;
  onFileClose: (path: string) => void;
  onFileSave: (path: string) => void;
  onEditorReady: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onOutlineChange: (outline: OutlineData[]) => void;
}

export function EditorPane({
  openFiles,
  activeFilePath,
  dirtyFiles,
  onFileSelect,
  onFileChange,
  onFileClose,
  onFileSave,
  onEditorReady,
  onOutlineChange,
}: EditorPaneProps) {

  if (openFiles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground bg-background p-4">
        <FileIcon filename="placeholder.tsx" className="h-16 w-16 mb-4" />
        <h2 className="text-xl font-medium font-headline">Welcome to WebCoder.ai</h2>
        <p>Select a file from the explorer to begin editing.</p>
        <p className="text-xs mt-2">Right-click in the explorer to create files or folders.</p>
      </div>
    );
  }

  const AudioPlayer = ({ file }: { file: VFSFile }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-muted/20 p-4">
            <div className="w-full max-w-md text-center">
                <FileIcon filename={file.name} className="h-24 w-24 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">{file.name}</h3>
                <audio controls src={file.content} className="w-full">
                    Your browser does not support the audio element.
                </audio>
            </div>
        </div>
    );
  };

  const renderFileContent = (file: VFSFile) => {
    if (isImageFile(file.name)) {
        return <div className="relative h-full w-full flex items-center justify-center bg-muted/20 p-4">
            <Image src={file.content} alt={file.name} layout="fill" objectFit="contain" />
        </div>
    }

    if (isAudioFile(file.name)) {
        return <AudioPlayer file={file} />;
    }

    if (isJavaClassFile(file.name)) {
        return <JavaClassViewer file={file} />;
    }

    if (isTextFile({name: file.name})) {
      return <CodeEditor
        path={file.path}
        value={file.content}
        onChange={(newContent) => onFileChange(file.path, newContent)}
        onEditorReady={onEditorReady}
        onOutlineChange={onOutlineChange}
      />
    }

    // Default to Hex Viewer for other binary files
    return <HexViewer file={file} />;
  }

  return (
    <Tabs
      value={activeFilePath || ""}
      onValueChange={(path) => {
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
                  <FileIcon filename={file.name} className="h-4 w-4" />
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
