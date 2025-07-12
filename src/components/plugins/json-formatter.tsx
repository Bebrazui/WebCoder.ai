
"use client";

import { useState, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Wand2 } from "lucide-react";

export function JsonFormatter() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (input.trim() === "") {
      setError(null);
      return;
    }
    try {
      JSON.parse(input);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [input]);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, 2);
      setInput(formatted);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEditorMount: OnMount = (editor) => {
    // You can add editor configurations here if needed
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border flex justify-between items-center">
        <h2 className="text-lg font-headline font-semibold">JSON Formatter</h2>
        <Button onClick={handleFormat} size="sm" disabled={!!error || !input}>
          <Wand2 className="mr-2 h-4 w-4" />
          Format
        </Button>
      </div>

      <div className="flex-grow p-2 relative">
        <div className="h-full rounded-md border border-input bg-muted">
            <Editor
            value={input}
            onChange={(v) => setInput(v || "")}
            onMount={handleEditorMount}
            language="json"
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
      </div>
      <div className="p-2 border-t border-border">
        {input.trim() === "" ? (
             <Alert variant="default" className="bg-transparent border-0">
                <AlertDescription>
                    Paste your JSON here to format or validate it.
                </AlertDescription>
            </Alert>
        ) : error ? (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Invalid JSON</AlertTitle>
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        ) : (
          <Alert variant="default" className="bg-green-600/10 border-green-600/30">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-400">Valid JSON</AlertTitle>
          </Alert>
        )}
      </div>
    </div>
  );
}
