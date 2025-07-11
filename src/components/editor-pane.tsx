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
import { X, Code, Image as ImageIcon, FileQuestion, Save, Database } from "lucide-react";
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

const isImageFile = (path: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(path);
}

const isBinaryDataURI = (content: string) => {
    if (!content.startsWith('data:')) return false;
    const mime = content.substring(5, content.indexOf(';'));
    // Consider binary if not text and not an image mime type
    return !mime.startsWith('text') && !mime.startsWith('image');
}

const UnsupportedFileViewer = ({ file }: { file: VFSFile }) => {
    const handleDownload = () => {
        try {
            const link = document.createElement('a');
            link.href = file.content; // Assumes content is a data URI
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Download failed", e);
        }
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

const getFileIcon = (file: VFSFile) => {
    if (isImageFile(file.path)) return <ImageIcon className="h-4 w-4" />;
    if (isBinaryDataURI(file.content)) return <Database className="h-4 w-4" />;
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
  if (openFiles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
        <Code className="h-16 w-16 mb-4" />
        <h2 className="text-xl font-medium font-headline">Welcome to WebCoder.ai</h2>
        <p>Select a file from the explorer to begin editing.</p>
        <p className="text-xs mt-2">Right-click in the explorer to create files or folders.</p>
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
                {getFileIcon(file)}
                <span>{file.name}</span>
                {isDirty && (
                    <div className="flex items-center gap-1 ml-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onFileSave(file.path);
                            }}
                            className="p-0.5 rounded-sm hover:bg-accent"
                            aria-label={`Save ${file.name}`}
                        >
                            <Save className="h-3 w-3 text-blue-500" />
                        </button>
                        <div className="h-2 w-2 rounded-full bg-blue-500" title="Unsaved changes"></div>
                    </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileClose(file.path);
                  }}
                  className="p-0.5 rounded-sm hover:bg-destructive/80 ml-1"
                  aria-label={`Close ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </TabsTrigger>
            );
          })}
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
             ) : isBinaryDataURI(file.content) ? (
                <HexViewer file={file} />
             ) : (
                <CodeEditor
                    path={file.path}
                    value={file.content}
                    onChange={(newContent) => onFileChange(file.path, newContent)}
                />
             )}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
