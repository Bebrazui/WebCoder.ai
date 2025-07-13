
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayCircle, LoaderCircle, ServerCrash, Settings2, FileWarning, Hammer, CheckCircle, FilePlus, FolderInput, Binary, Airplay } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVfs } from "@/hooks/use-vfs";
import type { VFSFile, VFSNode, VFSDirectory } from "@/lib/vfs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppState } from "@/hooks/use-app-state";

interface LaunchConfig {
    name: string;
    type: string;
    request: 'launch';
    args: any;
    [key: string]: any; // Allow other properties
}

const findJavaFiles = (node: VFSNode): boolean => {
    if (node.type === 'file' && node.name.endsWith('.java')) {
        return true;
    }
    if (node.type === 'directory') {
        for (const child of node.children) {
            if (findJavaFiles(child)) {
                return true;
            }
        }
    }
    return false;
};

const defaultJavaConfig: LaunchConfig = {
    name: "Run Java App (auto-detected)",
    type: "java",
    request: "launch",
    mainClass: "Main",
    sourcePaths: ["."],
    classPaths: [],
    args: {
      name: "Java User",
      age: 42
    }
};

export function RunView() {
  const { toast } = useToast();
  const { vfsRoot, createFileInVfs } = useVfs();
  const { editorSettings } = useAppState();
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [launchFile, setLaunchFile] = useState<VFSFile | null>(null);
  const [launchConfigs, setLaunchConfigs] = useState<LaunchConfig[]>([]);
  const [selectedConfigName, setSelectedConfigName] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  
  const [isCompiled, setIsCompiled] = useState(false);

  useEffect(() => {
    const findLaunchFile = (node: VFSNode): VFSFile | null => {
        if (node.name === 'launch.json' && node.type === 'file') {
            return node;
        }
        if (node.type === 'directory' && node.path === '/') {
            for (const child of node.children) {
                if (child.name === 'launch.json' && child.type === 'file') {
                    return child;
                }
            }
        }
        return null;
    }
    const file = findLaunchFile(vfsRoot);
    setLaunchFile(file);

    let configs: LaunchConfig[] = [];
    if (file) {
        try {
            const parsed = JSON.parse(file.content);
            configs = parsed.configurations || [];
        } catch (e) {
            console.error("Error parsing launch.json:", e);
            toast({ variant: 'destructive', title: 'Invalid launch.json', description: 'Could not parse launch.json file.' });
        }
    }

    const hasJavaConfig = configs.some(c => c.type === 'java');
    if (!hasJavaConfig && findJavaFiles(vfsRoot)) {
        configs.push(defaultJavaConfig);
    }
    
    setLaunchConfigs(configs);

    if (configs.length > 0 && (!selectedConfigName || !configs.some(c => c.name === selectedConfigName))) {
        setSelectedConfigName(configs[0].name);
    } else if (configs.length === 0) {
         setSelectedConfigName(null);
    }
  }, [vfsRoot, toast]);

  const selectedConfig = useMemo(() => {
      return launchConfigs.find(c => c.name === selectedConfigName);
  }, [launchConfigs, selectedConfigName]);

  const isJavaConfig = selectedConfig?.type === 'java';

  useEffect(() => {
    setIsCompiled(false);
    if (selectedConfig) {
        setJsonInput(JSON.stringify(selectedConfig.args, null, 2));
    } else {
        setJsonInput('{}');
    }
  }, [selectedConfig]);

  const getFullConfig = useCallback(() => {
      if (!selectedConfig) return null;

      let argsToUse;
      try {
          if (editorSettings.manualJsonInput && jsonInput.trim()) {
              argsToUse = JSON.parse(jsonInput);
          } else {
              argsToUse = selectedConfig.args || {};
          }
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Invalid JSON Arguments', description: `Could not parse JSON: ${e.message}` });
          return null;
      }
      
      const fullConfig = { ...selectedConfig, args: argsToUse };
      return fullConfig;
  }, [selectedConfig, jsonInput, editorSettings.manualJsonInput, toast]);

  const handleAction = useCallback(async (action: 'compile' | 'run') => {
      const fullConfig = getFullConfig();
      if (!fullConfig) {
          toast({ variant: 'destructive', title: 'No Configuration', description: 'Please select a valid launch configuration.' });
          return;
      }
      
      if (action === 'run' && isJavaConfig && !fullConfig.mainClass) {
           toast({ variant: 'destructive', title: 'Missing Main Class', description: 'Please provide a Main Class name to run the Java application.' });
           return;
      }

      setIsLoading(true);
      setResult(null);
      setError(null);

      const apiEndpoint = action === 'compile' ? `/api/compile-java` : `/api/run-${fullConfig.type}`;

      try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectFiles: [vfsRoot], // Pass root node
                config: fullConfig,
            }),
        });

        const responseData = await response.json();

        if (!response.ok || !responseData.success) {
            throw new Error(responseData.error || 'An unknown error occurred.');
        }

        if (action === 'compile') {
            setIsCompiled(true);
            toast({ title: "Compilation Successful", description: "Your Java code has been compiled." });
            setResult(responseData.data);
        } else {
            setResult(responseData.data);
            toast({ title: "Execution Successful", description: `'${fullConfig.name}' ran successfully.` });
        }
      } catch (err: any) {
        console.error(`Failed to ${action} '${fullConfig.name}':`, err);
        setError(err.message || "Failed to communicate with the server.");
        if(action === 'compile') setIsCompiled(false);
      } finally {
        setIsLoading(false);
      }
  }, [getFullConfig, toast, vfsRoot, isJavaConfig]);

  const handleAddLaunchJson = useCallback(() => {
      const content = `
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Python Script",
      "type": "python",
      "request": "launch",
      "program": "my_script.py",
      "args": { "name": "World" }
    }
  ]
}
      `.trim();
      createFileInVfs('launch.json', vfsRoot as VFSDirectory, content);
      toast({ title: '`launch.json` created', description: 'File was added to the root of your project.' });
  }, [createFileInVfs, vfsRoot, toast]);


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
            {!launchFile && launchConfigs.length === 0 ? (
                <Alert variant="default" className="flex flex-col items-center text-center gap-4">
                    <FileWarning className="h-8 w-8" />
                    <AlertTitle>No `launch.json` Found</AlertTitle>
                    <AlertDescription>
                       Create a `launch.json` file to define run configurations for different languages.
                    </AlertDescription>
                    <Button onClick={handleAddLaunchJson} size="sm">
                        <FilePlus className="mr-2 h-4 w-4" />
                        Add launch.json
                    </Button>
                </Alert>
            ) : launchConfigs.length === 0 ? (
                 <Alert variant="destructive">
                    <FileWarning className="h-4 w-4" />
                    <AlertTitle>No Configurations</AlertTitle>
                    <AlertDescription>
                       Your `launch.json` is empty or no runnable files were detected. Add a configuration to start.
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-2">
                         <Label htmlFor="launch-config">Launch Configuration</Label>
                         <Select value={selectedConfigName || ''} onValueChange={setSelectedConfigName}>
                            <SelectTrigger id="launch-config">
                                <SelectValue placeholder="Select a configuration..." />
                            </SelectTrigger>
                            <SelectContent>
                                {launchConfigs.map(config => (
                                    <SelectItem key={config.name} value={config.name}>
                                        {config.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedConfig && (
                         <Alert variant="default">
                            <Settings2 className="h-4 w-4" />
                            <AlertTitle className="capitalize">{selectedConfig.type}</AlertTitle>
                            <AlertDescription>
                                {selectedConfig.program || selectedConfig.projectPath || selectedConfig.mainClass || '...'}
                            </AlertDescription>
                        </Alert>
                    )}

                    {editorSettings.manualJsonInput && (
                        <div className="space-y-2">
                            <Label htmlFor="input-data">JSON Arguments (for console apps)</Label>
                            <Textarea
                                id="input-data"
                                placeholder='{ "key": "value" }'
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                className="font-mono text-sm min-h-[120px]"
                                rows={5}
                            />
                        </div>
                    )}
                </div>
            )}
            
            {launchConfigs.length > 0 && isJavaConfig ? (
                <div className="grid grid-cols-2 gap-4">
                    <Button onClick={() => handleAction('compile')} disabled={isLoading || !selectedConfigName} className="w-full">
                        {isLoading ? <LoaderCircle className="animate-spin" /> : <Hammer />}
                        Compile
                    </Button>
                     <Button onClick={() => handleAction('run')} disabled={isLoading || !selectedConfigName || !isCompiled} className="w-full">
                        {isLoading ? <LoaderCircle className="animate-spin" /> : <PlayCircle />}
                        Run
                    </Button>
                </div>
            ) : (
                 launchConfigs.length > 0 && <Button onClick={() => handleAction('run')} disabled={isLoading || !selectedConfigName} className="w-full">
                    {isLoading ? <LoaderCircle className="animate-spin" /> : <PlayCircle />}
                    Run
                </Button>
            )}

            {isCompiled && isJavaConfig && (
                 <Alert variant="default" className="border-green-500/50 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertTitle>Compiled Successfully</AlertTitle>
                    <AlertDescription>
                        Ready to run the application.
                    </AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <ServerCrash className="h-4 w-4" />
                    <AlertTitle>Execution Error</AlertTitle>
                    <AlertDescription>
                        <pre className="text-xs whitespace-pre-wrap font-mono">{error}</pre>
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
