
"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from 'react-markdown';
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";

export function MarkdownPreviewer() {
  const [markdown, setMarkdown] = useState("# Hello, Markdown!\n\nStart typing here...");

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold">Markdown Previewer</h2>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-grow">
        <ResizablePanel defaultSize={50}>
            <div className="h-full">
                <Editor
                    value={markdown}
                    onChange={(v) => setMarkdown(v || "")}
                    language="markdown"
                    theme="vs-dark"
                    loading={<Skeleton className="h-full w-full" />}
                    options={{
                        fontFamily: "'Source Code Pro', monospace",
                        fontSize: 14,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        automaticLayout: true,
                    }}
                />
            </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
            <ScrollArea className="h-full">
                <div className="prose prose-invert p-4">
                    <ReactMarkdown>{markdown}</ReactMarkdown>
                </div>
            </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

