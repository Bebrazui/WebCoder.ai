// src/components/run-view.tsx
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayCircle, LoaderCircle, ServerCrash, Settings2, FileWarning, Hammer, CheckCircle, FilePlus, Gamepad2, BrainCircuit, AppWindow, Atom } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVfs } from "@/hooks/use-vfs";
import type { VFSFile, VFSNode, VFSDirectory } from "@/lib/vfs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppState } from "@/hooks/use-app-state";
import { CheerpJRunnerDialog } from "./cheerpj-runner";
import { cn } from "@/lib/utils";
import type { LaunchConfig } from "./file-explorer";

interface RunResult {
    stdout: string;
    stderr: string;
    hasError: boolean;
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


export function RunView({ onSelectFile }: RunViewProps) {
  const { toast } = useToast();
  const { vfsRoot, createFileInVfs, compileJavaProject, findFileByPath } = useVfs();
  const { editorSettings, isElectron } = useAppState();
  
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  
  const [launchFile, setLaunchFile] = useState<VFSFile | null>(null);
  const [launchConfigs, setLaunchConfigs] = useState<LaunchConfig[]>([]);
  const [selectedConfigName, setSelectedConfigName] = useState<string | null>(null);
    
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

  const handleRun = useCallback(async () => {
      if (!selectedConfig) {
          toast({ variant: 'destructive', title: 'No Configuration', description: 'Please select a valid launch configuration.' });
          return;
      }

      setIsActionLoading(true);
      setResult(null);
      const apiEndpoint = `/api/run-${selectedConfig.type}`;

      try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectFiles: [vfsRoot], config: selectedConfig }),
        });
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.error || 'An unknown server error occurred.');
        }

        if (selectedConfig.type === 'synthesis' && !responseData.data.hasError) {
             const encodedJson = encodeURIComponent(responseData.data.stdout);
             if (isElectron && window.electronAPI) {
                 localStorage.setItem('synthesis_ui_data', responseData.data.stdout);
                 (window as any).electronAPI.openSynthesisWindow();
             } else {
                 window.open(`/synthesis-runner?data=${encodedJson}`, '_blank');
             }
             setResult({ stdout: 'SYNTHESIS UI launched in new window.', stderr: '', hasError: false });
        } else if (!responseData.success) {
            setResult({ stdout: responseData.data?.stdout || '', stderr: responseData.error || responseData.data?.stderr, hasError: true });
        } else {
            setResult(responseData.data);
            if (!responseData.data.hasError) {
              toast({ title: "Execution Successful", description: `'${selectedConfig.name}' ran successfully.` });
            }
        }
      } catch (err: any) {
        console.error(`Failed to run '${selectedConfig.name}':`, err);
        setResult({ stdout: '', stderr: err.message || "Failed to communicate with the server.", hasError: true });
      } finally {
        setIsActionLoading(false);
      }
  }, [selectedConfig, toast, vfsRoot, isElectron]);

  const handleCompile = async () => {
    setIsActionLoading(true);
    setResult(null);
    const success = await compileJavaProject();
    if(success) {
      setResult({ stdout: "Project compiled successfully. The 'build' directory has been created/updated.", stderr: '', hasError: false });
    } else {
      setResult({ stdout: '', stderr: "Compilation failed. Check the toast notification for more details.", hasError: true });
    }
    setIsActionLoading(false);
  }

  const handleAddLaunchJson = useCallback(() => {
      const content = `{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run SYNTHESIS App",
      "type": "synthesis",
      "request": "launch",
      "program": "/TodoApp.syn"
    }
  ]
}
`;
      createFileInVfs('launch.json', vfsRoot as VFSDirectory, content);
      toast({ title: '`launch.json` created', description: 'File was added to the root of your project.' });
  }, [createFileInVfs, vfsRoot, toast]);

  const handleEditLaunchConfig = () => {
      if (launchFile) {
          onSelectFile(launchFile);
      } else {
        handleAddLaunchJson();
      }
  }


  return (
    <>
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Button onClick={() => handleRun()} disabled={isActionLoading || !selectedConfigName} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                {isActionLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                <span className="ml-2">Run</span>
            </Button>
            <Select value={selectedConfigName || ''} onValueChange={setSelectedConfigName}>
                <SelectTrigger id="launch-config" className="h-9 w-auto border-0 bg-transparent focus:ring-0">
                    <SelectValue placeholder="Select configuration..." />
                </SelectTrigger>
                <SelectContent>
                    {launchConfigs.length > 0 ? launchConfigs.map(config => (
                        <SelectItem key={config.name} value={config.name}>
                            <div className="flex items-center gap-2">
                                {config.type === 'synthesis' ? <Atom className="h-4 w-4" /> 
                                 : <PlayCircle className="h-4 w-4" />}
                                <span>{config.name}</span>
                            </div>
                        </SelectItem>
                    )) : <div className="p-2 text-sm text-muted-foreground">No configurations found.</div>}
                </SelectContent>
            </Select>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditLaunchConfig}>
            <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-4 space-y-4">
            {launchConfigs.length === 0 ? ( 
                <Alert variant="default" className="flex flex-col items-center text-center gap-4">
                    <FileWarning className="h-8 w-8" />
                    <AlertTitle>No `launch.json` Found</AlertTitle>
                    <AlertDescription>
                       You can run simple scripts via the context menu in the Explorer, or create a `launch.json` file for more complex configurations.
                    </AlertDescription>
                    <Button onClick={handleAddLaunchJson} size="sm">
                        <FilePlus className="mr-2 h-4 w-4" />
                        Add launch.json
                    </Button>
                </Alert>
            ) : (
                <div className="space-y-4">
                    {/* The configuration selection is now in the header */}
                </div>
            )}
            
             {isJavaConfig && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Java Actions</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <Button onClick={handleCompile} disabled={isActionLoading} variant="outline" className="w-full">
                            {isActionLoading ? <LoaderCircle className="animate-spin" /> : <Hammer />}
                            Compile Java Project
                        </Button>
                    </div>
                </div>
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

            {result && (
                <div className="space-y-2 pt-4">
                    <h3 className="font-medium">Output</h3>
                    {result.stdout && (
                        <div>
                            <Label>{selectedConfig?.type === 'synthesis' ? 'Build Log' : 'stdout'}</Label>
                            <pre className="rounded-md border p-4 bg-muted font-mono text-sm whitespace-pre-wrap min-h-[50px] max-h-96 overflow-auto">
                                <code>{result.stdout || "No standard output."}</code>
                            </pre>
                        </div>
                    )}
                     {result.stderr && (
                        <div>
                            <Label className="text-destructive">stderr</Label>
                            <pre className="rounded-md border p-4 bg-destructive/10 text-destructive font-mono text-sm whitespace-pre-wrap min-h-[50px] max-h-96 overflow-auto">
                                <code>{result.stderr || "No standard error output."}</code>
                            </pre>
                        </div>
                    )}
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
