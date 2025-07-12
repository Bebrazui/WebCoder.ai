
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayCircle, LoaderCircle, ServerCrash, Code2, Workflow } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVfs } from "@/hooks/use-vfs";
import type { VFSNode, VFSFile } from "@/lib/vfs";
import { useAppState } from "@/hooks/use-app-state";

type LanguageSupport = {
  id: 'python' | 'java' | 'go' | 'ruby' | 'php' | 'rust' | 'csharp';
  name: string;
  entryPointLabel: string;
  defaultEntryPoint: string;
  defaultInput: string;
  detect: (files: VFSNode[]) => boolean;
  getApiEndpoint: () => string;
};

const supportedLanguages: LanguageSupport[] = [
  { id: 'python', name: 'Python', entryPointLabel: 'Entry Point Script', defaultEntryPoint: 'python_scripts/my_script.py', defaultInput: '{"name": "World", "value": 123}', detect: (files) => files.some(f => f.name.endsWith('.py')), getApiEndpoint: () => '/api/run-python' },
  { id: 'java', name: 'Java', entryPointLabel: 'Main Class Name', defaultEntryPoint: 'MyJavaApp', defaultInput: '{"name": "World", "age": 30}', detect: (files) => files.some(f => f.name.endsWith('.java')), getApiEndpoint: () => '/api/run-java' },
  { id: 'go', name: 'Go', entryPointLabel: 'Package path (use .)', defaultEntryPoint: 'go_apps/main.go', defaultInput: '{"name": "World", "value": 456}', detect: (files) => files.some(f => f.name.endsWith('.go')), getApiEndpoint: () => '/api/run-go' },
  { id: 'ruby', name: 'Ruby', entryPointLabel: 'Entry Point Script', defaultEntryPoint: 'ruby_scripts/my_ruby_script.rb', defaultInput: '{"name": "World", "value": 789}', detect: (files) => files.some(f => f.name.endsWith('.rb')), getApiEndpoint: () => '/api/run-ruby' },
  { id: 'php', name: 'PHP', entryPointLabel: 'Entry Point Script', defaultEntryPoint: 'php_scripts/my_php_script.php', defaultInput: '{"name": "World", "value": 101}', detect: (files) => files.some(f => f.name.endsWith('.php')), getApiEndpoint: () => '/api/run-php' },
  { id: 'rust', name: 'Rust', entryPointLabel: 'Cargo Project Path', defaultEntryPoint: 'rust_apps', defaultInput: '{"name": "World", "value": 202}', detect: (files) => files.some(f => f.name === 'Cargo.toml' && f.path.includes('rust_apps')), getApiEndpoint: () => '/api/run-rust' },
  { id: 'csharp', name: 'C#', entryPointLabel: 'Project Folder Name', defaultEntryPoint: 'my_csharp_app', defaultInput: '{"name": "World", "value": 303}', detect: (files) => files.some(f => f.name.endsWith('.csproj')), getApiEndpoint: () => '/api/run-csharp' },
];

const flattenVfs = (nodes: VFSNode[]): VFSNode[] => {
    return nodes.reduce((acc, node) => {
        acc.push(node);
        if (node.type === 'directory') {
            acc.push(...flattenVfs(node.children));
        }
        return acc;
    }, [] as VFSNode[]);
};

export function RunView() {
  const { toast } = useToast();
  const { vfsRoot } = useVfs();
  const { editorSettings } = useAppState();
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [scenarioFile, setScenarioFile] = useState<VFSFile | null>(null);

  const flattenedFiles = useMemo(() => flattenVfs(vfsRoot.children), [vfsRoot]);

  const detectedLanguage = useMemo(() => {
    return supportedLanguages.find(lang => lang.detect(flattenedFiles)) || null;
  }, [flattenedFiles]);
  
  useEffect(() => {
    const foundScenario = flattenedFiles.find(f => f.name === 'run.polyglot.json' && f.type === 'file') as VFSFile | undefined;
    setScenarioFile(foundScenario || null);
  }, [flattenedFiles]);

  useEffect(() => {
    if (detectedLanguage && !scenarioFile) {
        setInputValue(detectedLanguage.defaultInput);
    } else {
        setInputValue('');
    }
  }, [detectedLanguage, scenarioFile]);
  
  const handleRun = useCallback(async () => {
    if (scenarioFile) {
      await handleRunScenario();
      return;
    }

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
      let jsonToParse: string;

      if (editorSettings.manualJsonInput) {
        jsonToParse = inputValue.trim() === '' ? detectedLanguage.defaultInput : inputValue;
      } else {
        jsonToParse = detectedLanguage.defaultInput;
      }

      parsedInput = JSON.parse(jsonToParse);
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
          entryPoint: detectedLanguage.defaultEntryPoint,
      };
      
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
  }, [detectedLanguage, inputValue, vfsRoot, toast, scenarioFile, editorSettings.manualJsonInput]);

  const handleRunScenario = async () => {
    if (!scenarioFile) return;

    let parsedScenario;
    try {
      parsedScenario = JSON.parse(scenarioFile.content);
    } catch(e) {
      toast({ variant: "destructive", title: "Invalid Scenario", description: "The run.polyglot.json file contains invalid JSON."});
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
        const response = await fetch('/api/run-polyglot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectFiles: vfsRoot.children, scenario: parsedScenario }),
        });

        const responseData = await response.json();
        if (!response.ok || !responseData.success) {
            throw new Error(responseData.error || 'An unknown error occurred while running the scenario.');
        }

        setResult(responseData.data);
        toast({ title: "Scenario Successful", description: `Polyglot scenario ran successfully.` });
    } catch (err: any) {
        console.error('Failed to run polyglot scenario:', err);
        setError(err.message || 'Failed to execute the scenario.');
    } finally {
        setIsLoading(false);
    }
  };


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
            {scenarioFile ? (
                 <Alert variant="default" className="border-purple-500/50 text-purple-700 dark:text-purple-400 [&>svg]:text-purple-500">
                    <Workflow className="h-4 w-4" />
                    <AlertTitle>Polyglot Scenario Detected</AlertTitle>
                    <AlertDescription>
                        Found <strong>run.polyglot.json</strong>. The runner will execute the defined multi-language scenario.
                    </AlertDescription>
                </Alert>
            ) : detectedLanguage ? (
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

            {!scenarioFile && editorSettings.manualJsonInput && (
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
            )}
            
            <Button onClick={handleRun} disabled={isLoading || (!detectedLanguage && !scenarioFile)} className="w-full">
                {isLoading ? <LoaderCircle className="animate-spin" /> : (scenarioFile ? <Workflow/> : <PlayCircle />)}
                {scenarioFile ? "Run Scenario" : "Run Project"}
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
                <Label>Result</Label>
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
