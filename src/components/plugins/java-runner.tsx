
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code2, LoaderCircle, ServerCrash, Hammer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "../ui/input";
import { useVfs } from "@/hooks/use-vfs";

export function JavaRunner() {
  const [inputValue, setInputValue] = useState('{"name": "Пользователь", "age": 25}');
  const [entryPoint, setEntryPoint] = useState('MyJavaApp');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const { vfsRoot } = useVfs();

  const handleRunApp = async () => {
    let parsedInput;
    try {
      parsedInput = JSON.parse(inputValue);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "The input must be a valid JSON object.",
      });
      return;
    }
    
    if (!entryPoint.trim()) {
       toast({
        variant: "destructive",
        title: "Invalid Entry Point",
        description: "Please specify the main class name.",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/run-java', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            projectFiles: vfsRoot.children,
            entryPoint: entryPoint,
            inputData: parsedInput 
        }),
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.error || 'An unknown error occurred.');
      }
      
      setResult(responseData.data);

    } catch (err: any) {
      console.error("Failed to run Java app:", err);
      setError(err.message || "Failed to communicate with the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold">Java App Runner</h2>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-4 space-y-4">
            <Alert>
                <Hammer className="h-4 w-4" />
                <AlertTitle>On-Demand Compilation & Execution</AlertTitle>
                <AlertDescription>
                    <p>This tool sends your current project files to a secure server environment, compiles them, and runs the application. Your files are not stored on the server after execution.</p>
                     <p className="mt-2">Ensure your Java files are in a <code className="font-mono bg-muted p-1 rounded-sm">src</code> directory and any JAR dependencies are in a <code className="font-mono bg-muted p-1 rounded-sm">lib</code> directory.</p>
                </AlertDescription>
            </Alert>
             <div className="space-y-2">
                <Label htmlFor="entry-point">Main Class Name</Label>
                <Input
                id="entry-point"
                placeholder="e.g., com.example.Main or MyJavaApp"
                value={entryPoint}
                onChange={(e) => setEntryPoint(e.target.value)}
                className="font-mono text-sm"
                />
            </div>
          <div className="space-y-2">
            <Label htmlFor="input-data">Input JSON for App</Label>
            <Textarea
              id="input-data"
              placeholder='{ "key": "value" }'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="font-mono text-sm min-h-[100px]"
            />
          </div>
          
          <Button onClick={handleRunApp} disabled={isLoading} className="w-full">
            {isLoading ? <LoaderCircle className="animate-spin" /> : <Code2 />}
            Compile & Run Java App
          </Button>

          {error && (
            <Alert variant="destructive">
                <ServerCrash className="h-4 w-4" />
                <AlertTitle>Execution Error</AlertTitle>
                <AlertDescription>
                    <pre className="text-xs whitespace-pre-wrap">{error}</pre>
                </AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-2 pt-4">
              <Label>Result from Java</Label>
              <div className="rounded-md border bg-muted p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
