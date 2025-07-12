
"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { WandSparkles, LoaderCircle, Clipboard, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateSql } from "@/ai/flows/generate-sql-flow";

export function SqlGenerator() {
  const [prompt, setPrompt] = useState("");
  const [schema, setSchema] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState("");
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a description for the SQL query.",
      });
      return;
    }

    setIsLoading(true);
    setResult("");
    try {
      const response = await generateSql({ prompt, schema });
      setResult(response.sqlQuery);
    } catch (error) {
      console.error("SQL generation failed:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "The AI could not generate the SQL query. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold">AI SQL Generator</h2>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schema">Database Schema (Optional)</Label>
            <Textarea
              id="schema"
              placeholder="e.g., CREATE TABLE users (id INT, name VARCHAR(255));"
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              className="font-code text-xs min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">Description</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., Get all users who signed up last week"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
            {isLoading ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}
            Generate SQL
          </Button>

          {result && (
            <div className="space-y-2 pt-4">
              <div className="flex justify-between items-center">
                <Label>Generated SQL</Label>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {hasCopied ? <ClipboardCheck className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  <span className="ml-2">{hasCopied ? 'Copied!' : 'Copy'}</span>
                </Button>
              </div>
              <div className="h-64 rounded-md border border-input bg-muted">
                <Editor
                  value={result}
                  language="sql"
                  theme="vs-dark"
                  loading={<Skeleton className="h-full w-full" />}
                  options={{
                    readOnly: true,
                    fontFamily: "'Source Code Pro', monospace",
                    fontSize: 14,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
