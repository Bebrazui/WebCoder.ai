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
import { X, Code } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorPaneProps {
  openFiles: VFSFile[];
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileChange: (path: string, newContent: string) => void;
  onFileClose: (path: string) => void;
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
            <CodeEditor
              path={file.path}
              value={file.content}
              onChange={(newContent) => onFileChange(file.path, newContent)}
            />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
