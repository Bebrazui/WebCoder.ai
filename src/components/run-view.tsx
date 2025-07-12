
"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayCircle, LoaderCircle, ServerCrash, Hammer, Code2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVfs } from "@/hooks/use-vfs";
import type { VFSNode } from "@/lib/vfs";

type LanguageSupport = {
  id: 'python' | 'java' | 'go' | 'ruby' | 'php' | 'rust' | 'csharp';
  name: string;
  entryPointLabel: string;
  defaultEntryPoint: string;
  detect: (files: VFSNode[]) => boolean;
  getApiEndpoint: () => string;
};

const supportedLanguages: LanguageSupport[] = [
  { id: 'python', name: 'Python', entryPointLabel: 'Entry Point Script', defaultEntryPoint: 'my_script.py', detect: (files) => files.some(f => f.name.endsWith('.py')), getApiEndpoint: () => '/api/run-python' },
  { id: 'java', name: 'Java', entryPointLabel: 'Main Class Name', defaultEntryPoint: 'MyJavaApp', detect: (files) => files.some(f => f.name.endsWith('.java')), getApiEndpoint: () => '/api/run-java' },
  { id: 'go', name: 'Go', entryPointLabel: 'Package path (use .)', defaultEntryPoint: '.', detect: (files) => files.some(f => f.name.endsWith('.go')), getApiEndpoint: () => '/api/run-go' },
  { id: 'ruby', name: 'Ruby', entryPointLabel: 'Entry Point Script', defaultEntryPoint: 'my_ruby_script.rb', detect: (files) => files.some(f => f.name.endsWith('.rb')), getApiEndpoint: () => '/api/run-ruby' },
  { id: 'php', name: 'PHP', entryPointLabel: 'Entry Point Script', defaultEntryPoint: 'my_php_script.php', detect: (files) => files.some(f => f.name.endsWith('.php')), getApiEndpoint: () => '/api/run-php' },
  { id: 'rust', name: 'Rust', entryPointLabel: 'Cargo Project (use .)', defaultEntryPoint: '.', detect: (files) => files.some(f => f.name === 'Cargo.toml'), getApiEndpoint: () => '/api/run-rust' },
  { id: 'csharp', name: 'C#', entryPointLabel: 'Project Folder Name', defaultEntryPoint: 'my_csharp_app', detect: (files) => files.some(f => f.name.endsWith('.csproj')), getApiEndpoint: () => '/api/run-csharp' },
];

export function RunView() {
  const { toast } = useToast();
  const { vfsRoot } = useVfs();
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const detectedLanguage = useMemo(() => {
    const flattenedFiles = (function flatten(nodes: VFSNode[]): VFSNode[] {
        return nodes.reduce((acc, node) => {
            acc.push(node);
            if (node.type === 'directory') {
                acc.push(...flatten(node.children));
            }
            return acc;
        }, [] as VFSNode[]);
    })(vfsRoot.children);
    
    return supportedLanguages.find(lang => lang.detect(flattenedFiles)) || null;
  }, [vfsRoot]);

  const [inputValue, setInputValue] = useState('{"name": "World", "value": 123}');
  
  const handleRun = useCallback(async () => {
    if (!detectedLanguage) {
      toast({
        variant: "destructive",
        title: "Cannot Run",
        description: "Could not detect a supported language in this project.",
      });
      return;
    }
    
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
      const apiEndpoint = detectedLanguage.getApiEndpoint();
      const body: any = {
          projectFiles: vfsRoot.children,
          inputData: parsedInput,
      };

      if (detectedLanguage.id === 'java' || detectedLanguage.id === 'csharp' || detectedLanguage.id === 'php' || detectedLanguage.id === 'python' || detectedLanguage.id === 'ruby') {
        body.entryPoint = detectedLanguage.defaultEntryPoint; // This should be made editable in the future
      }
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.error || 'An unknown error occurred.');
      }
      
      setResult(responseData.data);
      toast({
          title: "Execution Successful",
          description: `${detectedLanguage.name} project ran successfully.`
      });

    } catch (err: any) {
      console.error(`Failed to run ${detectedLanguage.name} app:`, err);
      setError(err.message || "Failed to communicate with the server.");
    } finally {
      setIsLoading(false);
    }
  }, [detectedLanguage, inputValue, vfsRoot, toast]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            <span>Run and Debug</span>
        </h2>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-4 space-y-4">
            {detectedLanguage ? (
                <Alert>
                    <Code2 className="h-4 w-4" />
                    <AlertTitle>Detected Language: {detectedLanguage.name}</AlertTitle>
                    <AlertDescription>
                        The runner will use the settings for {detectedLanguage.name}.
                    </AlertDescription>
                </Alert>
            ) : (
                 <Alert variant="destructive">
                    <ServerCrash className="h-4 w-4" />
                    <AlertTitle>No Supported Language Detected</AlertTitle>
                    <AlertDescription>
                        Could not find any supported project files (e.g., .py, .java, Cargo.toml) in the explorer.
                    </AlertDescription>
                </Alert>
            )}

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
            
            <Button onClick={handleRun} disabled={isLoading || !detectedLanguage} className="w-full">
                {isLoading ? <LoaderCircle className="animate-spin" /> : <PlayCircle />}
                Run Project
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
                <Label>Result from App</Label>
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
