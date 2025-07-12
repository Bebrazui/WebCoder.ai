
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code2, LoaderCircle, ServerCrash, Hammer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function JavaRunner() {
  const [inputValue, setInputValue] = useState('{"name": "Пользователь", "age": 25}');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

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

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/run-java', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataFromFrontend: parsedInput }),
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
                <AlertTitle>Prerequisites</AlertTitle>
                <AlertDescription>
                    <p>Before running, ensure you have compiled the Java project by running <code className="font-mono bg-muted p-1 rounded-sm">npm run compile-java</code> in your local terminal.</p>
                    <p className="mt-2">This command will compile all <code className="font-mono bg-muted p-1 rounded-sm">.java</code> files inside <code className="font-mono bg-muted p-1 rounded-sm">java_apps/src</code>, allowing for multi-file projects.</p>
                    <p className="mt-2">You also need to place any required <code className="font-mono bg-muted p-1 rounded-sm">.jar</code> files (like <code className="font-mono bg-muted p-1 rounded-sm">org.json.jar</code>) inside the <code className="font-mono bg-muted p-1 rounded-sm">java_apps/lib</code> directory.</p>
                </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
                This tool runs a compiled Java app on the server. You can pass a JSON object as input. The entry point must be the `main` method in the `MyJavaApp` class.
            </p>
          <div className="space-y-2">
            <Label htmlFor="input-data">Input JSON</Label>
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
            Run Java App
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
