// src/components/run-view.tsx
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayCircle, LoaderCircle, ServerCrash, Settings2, FileWarning, Hammer, CheckCircle, FilePlus, Gamepad2, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVfs } from "@/hooks/use-vfs";
import type { VFSFile, VFSNode, VFSDirectory } from "@/lib/vfs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppState } from "@/hooks/use-app-state";
import { CheerpJRunnerDialog } from "./cheerpj-runner";

interface LaunchConfig {
    name: string;
    type: string;
    request: 'launch';
    args?: any;
    [key: string]: any; // Allow other properties
}

interface RunViewProps {
    onSelectFile: (file: VFSFile) => void;
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

const findNoCodeHProject = (rootNode: VFSNode): boolean => {
    if (rootNode.type !== 'directory') return false;
    return rootNode.children.some(c => c.name === '.nocodeh');
};


const findBuildFolder = (node: VFSNode): boolean => {
    if (node.type === 'directory' && node.name === 'build') {
        return true;
    }
    if (node.type === 'directory') {
        for (const child of node.children) {
            if (findBuildFolder(child)) {
                return true;
            }
        }
    }
    return false;
}

const defaultJavaConfig: LaunchConfig = {
    name: "Run Java App (auto-detected)",
    type: "java",
    request: "launch",
    mainClass: "Main",
    sourcePaths: ["."],
    classPaths: ["build"],
    args: {
      name: "Java User",
      age: 42
    }
};

const noCodeHConfig: LaunchConfig = {
    name: "Run NoCodeH Game",
    type: "nocodeh",
    request: "launch",
};


export function RunView({ onSelectFile }: RunViewProps) {
  const { toast } = useToast();
  const { vfsRoot, createFileInVfs, compileJavaProject, findFileByPath } = useVfs();
  const { editorSettings } = useAppState();
  
  const [isActionLoading, setIsActionLoading] = useState(false); // For both run and compile
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [launchFile, setLaunchFile] = useState<VFSFile | null>(null);
  const [launchConfigs, setLaunchConfigs] = useState<LaunchConfig[]>([]);
  const [selectedConfigName, setSelectedConfigName] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  
  const [isCheerpJOpen, setIsCheerpJOpen] = useState(false);
  const [cheerpjJarUrl, setCheerpjJarUrl] = useState('');
  
  const isProjectCompiled = useMemo(() => findBuildFolder(vfsRoot), [vfsRoot]);

  const findLaunchFileAndConfigs = useCallback(() => {
    const file = findFileByPath('launch.json');
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
    
    if (findNoCodeHProject(vfsRoot) && !configs.some(c => c.type === 'nocodeh')) {
        configs.unshift(noCodeHConfig);
    }

    setLaunchConfigs(configs);

    if (configs.length > 0 && (!selectedConfigName || !configs.some(c => c.name === selectedConfigName))) {
        setSelectedConfigName(configs[0].name);
    } else if (configs.length === 0) {
         setSelectedConfigName(null);
    }
  }, [findFileByPath, vfsRoot, toast, selectedConfigName]);

  useEffect(() => {
    findLaunchFileAndConfigs();
  }, [vfsRoot, findLaunchFileAndConfigs]);

  const selectedConfig = useMemo(() => {
      return launchConfigs.find(c => c.name === selectedConfigName);
  }, [launchConfigs, selectedConfigName]);

  const isJavaConfig = selectedConfig?.type === 'java';

  useEffect(() => {
    if (selectedConfig && selectedConfig.args) {
        setJsonInput(JSON.stringify(selectedConfig.args, null, 2));
    } else {
        setJsonInput('{}');
    }
  }, [selectedConfig]);

  const getFullConfig = useCallback(() => {
      if (!selectedConfig) return null;

      let argsToUse = {};
      try {
          if (editorSettings.manualJsonInput && jsonInput.trim() && selectedConfig.args) {
              argsToUse = JSON.parse(jsonInput);
          } else if (selectedConfig.args) {
              argsToUse = selectedConfig.args;
          }
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Invalid JSON Arguments', description: `Could not parse JSON: ${e.message}` });
          return null;
      }
      
      const fullConfig = { ...selectedConfig, args: argsToUse };
      return fullConfig;
  }, [selectedConfig, jsonInput, editorSettings.manualJsonInput, toast]);

  const handleRun = useCallback(async (overrideConfig?: LaunchConfig) => {
      const fullConfig = overrideConfig || getFullConfig();
      if (!fullConfig) {
          toast({ variant: 'destructive', title: 'No Configuration', description: 'Please select a valid launch configuration.' });
          return;
      }
      
      if (fullConfig.type === 'nocodeh') {
          window.open('/nocode/play', '_blank');
          toast({ title: "Game Launched!", description: "Your NoCodeH game has been opened in a new tab."});
          return;
      }

      if (fullConfig.type === 'java-gui') {
          setIsActionLoading(true);
          setResult(null);
          setError(null);
          try {
             const response = await fetch('/api/prepare-jar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectFiles: [vfsRoot],
                    config: fullConfig
                })
             });
             const data = await response.json();
             if (!data.success) throw new Error(data.error);

             setCheerpjJarUrl(data.jarUrl);
             setIsCheerpJOpen(true);
          } catch (err: any) {
              setError(err.message || "Failed to prepare JAR for GUI runner.");
          } finally {
              setIsActionLoading(false);
          }
          return;
      }

      setIsActionLoading(true);
      setResult(null);
      setError(null);

      const apiEndpoint = `/api/run-${fullConfig.type}`;

      try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectFiles: [vfsRoot],
                config: fullConfig,
            }),
        });

        const responseData = await response.json();

        if (!response.ok || !responseData.success) {
            throw new Error(responseData.error || 'An unknown error occurred.');
        }

        setResult(responseData.data);
        toast({ title: "Execution Successful", description: `'${fullConfig.name}' ran successfully.` });
      } catch (err: any) {
        console.error(`Failed to run '${fullConfig.name}':`, err);
        setError(err.message || "Failed to communicate with the server.");
      } finally {
        setIsActionLoading(false);
      }
  }, [getFullConfig, toast, vfsRoot]);

  const handleCompile = async () => {
    setIsActionLoading(true);
    setResult(null);
    setError(null);
    const success = await compileJavaProject();
    if(success) {
      setResult({ message: "Project compiled successfully. The 'build' directory has been created/updated."});
    } else {
      setError("Compilation failed. Check console for details.")
    }
    setIsActionLoading(false);
  }

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

  const handleEditLaunchConfig = () => {
      if (launchFile) {
          onSelectFile(launchFile);
      } else {
          toast({ variant: 'destructive', title: "Not Found", description: "`launch.json` could not be found." });
      }
  }


  return (
    <>
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            <span>Run and Debug</span>
        </h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditLaunchConfig} disabled={!launchFile}>
            <Settings2 className="h-4 w-4" />
        </Button>
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
                                        <div className="flex items-center gap-2">
                                            {config.type === 'nocodeh' ? <Gamepad2 className="h-4 w-4" /> : <BrainCircuit className="h-4 w-4" />}
                                            <span>{config.name}</span>
                                        </div>
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
                                {selectedConfig.program || selectedConfig.projectPath || selectedConfig.mainClass || 'Ready to launch in browser.'}
                            </AlertDescription>
                        </Alert>
                    )}

                    {editorSettings.manualJsonInput && selectedConfig?.type !== 'nocodeh' && selectedConfig?.type !== 'java-gui' && (
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
                    <Button onClick={handleCompile} disabled={isActionLoading || !selectedConfigName} className="w-full">
                        {isActionLoading ? <LoaderCircle className="animate-spin" /> : <Hammer />}
                        Compile
                    </Button>
                     <Button onClick={() => handleRun()} disabled={isActionLoading || !selectedConfigName || !isProjectCompiled} className="w-full">
                        {isActionLoading ? <LoaderCircle className="animate-spin" /> : <PlayCircle />}
                        Run
                    </Button>
                </div>
            ) : (
                 launchConfigs.length > 0 && <Button onClick={() => handleRun()} disabled={isActionLoading || !selectedConfigName} className="w-full">
                    {isActionLoading ? <LoaderCircle className="animate-spin" /> : <PlayCircle />}
                    Run
                </Button>
            )}

            {isProjectCompiled && isJavaConfig && (
                 <Alert variant="default" className="border-green-500/50 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertTitle>Project Compiled</AlertTitle>
                    <AlertDescription>
                        The `build` directory is present. You can now run the application.
                    </AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <ServerCrash className="h-4 w-4" />
                    <AlertTitle>Action Error</AlertTitle>
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
    <CheerpJRunnerDialog 
        isOpen={isCheerpJOpen}
        onOpenChange={setIsCheerpJOpen}
        jarUrl={cheerpjJarUrl}
    />
    </>
  );
}
