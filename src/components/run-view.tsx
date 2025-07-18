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
import { cn } from "@/lib/utils";

interface LaunchConfig {
    name: string;
    type: string;
    request: 'launch';
    args?: any;
    [key: string]: any; // Allow other properties
}

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
  
  const [isActionLoading, setIsActionLoading] = useState(false); // For both run and compile
  const [result, setResult] = useState<RunResult | null>(null);
  
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
    
    configs.push({ name: "Auto-detect and Run...", type: "auto", request: "launch" });
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
      
      return { ...selectedConfig, args: argsToUse };
  }, [selectedConfig, jsonInput, editorSettings.manualJsonInput, toast]);

  const handleRun = useCallback(async (overrideConfig?: LaunchConfig) => {
      let fullConfig = overrideConfig || getFullConfig();
      if (!fullConfig) {
          toast({ variant: 'destructive', title: 'No Configuration', description: 'Please select a valid launch configuration.' });
          return;
      }

      if (fullConfig.type === 'auto') {
        const filePath = prompt("Enter the path to the script to run (e.g., python_scripts/my_script.py):");
        if (!filePath) return;
        
        const fileExtension = filePath.split('.').pop();
        let langType = '';
        switch(fileExtension) {
            case 'py': langType = 'python'; break;
            case 'js': langType = 'javascript'; break;
            case 'go': langType = 'go'; break;
            case 'rb': langType = 'ruby'; break;
            case 'php': langType = 'php'; break;
            default:
                toast({ variant: 'destructive', title: 'Unsupported File', description: `Auto-run for .${fileExtension} files is not supported.` });
                return;
        }

        fullConfig = {
            name: `Auto-run ${filePath}`,
            type: langType,
            request: 'launch',
            program: filePath,
            args: {}
        };
      }
      
      if (fullConfig.type === 'java-gui') {
          setIsActionLoading(true);
          setResult(null);
          try {
             const response = await fetch('/api/prepare-jar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectFiles: [vfsRoot], config: fullConfig })
             });
             const data = await response.json();
             if (!data.success) throw new Error(data.error);
             setCheerpjJarUrl(data.jarUrl);
             setIsCheerpJOpen(true);
          } catch (err: any) {
              setResult({ stdout: '', stderr: err.message || "Failed to prepare JAR for GUI runner.", hasError: true });
          } finally {
              setIsActionLoading(false);
          }
          return;
      }

      setIsActionLoading(true);
      setResult(null);
      const apiEndpoint = `/api/run-${fullConfig.type}`;

      try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectFiles: [vfsRoot], config: fullConfig }),
        });
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.error || 'An unknown server error occurred.');
        }

        if (fullConfig.type === 'synthesis') {
            const uiJsonString = responseData.success ? responseData.data.stdout : JSON.stringify({ type: 'Error', message: responseData.error });
            if (isElectron) {
                localStorage.setItem('synthesis_ui_data', uiJsonString);
                window.electronAPI.openSynthesisWindow();
            } else {
                window.open(`/synthesis-runner?data=${encodeURIComponent(uiJsonString)}`, '_blank');
            }
            if (responseData.success) {
                setResult({ stdout: 'SYNTHESIS app launched in new window.', stderr: '', hasError: false });
            } else {
                setResult({ stdout: '', stderr: responseData.error, hasError: true });
            }
        } else {
            if (!responseData.success) {
                setResult({ stdout: '', stderr: responseData.error, hasError: true });
            } else {
                setResult(responseData.data);
                if (!responseData.data.hasError) {
                  toast({ title: "Execution Successful", description: `'${fullConfig.name}' ran successfully.` });
                }
            }
        }
      } catch (err: any) {
        console.error(`Failed to run '${fullConfig.name}':`, err);
        setResult({ stdout: '', stderr: err.message || "Failed to communicate with the server.", hasError: true });
      } finally {
        setIsActionLoading(false);
      }
  }, [getFullConfig, toast, vfsRoot, isElectron]);

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
      "program": "main.syn",
      "platform": "ios"
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
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            <span>Run and Debug</span>
        </h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditLaunchConfig}>
            <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-4 space-y-4">
            {launchConfigs.length <= 1 ? ( // Only has "Auto-detect"
                <Alert variant="default" className="flex flex-col items-center text-center gap-4">
                    <FileWarning className="h-8 w-8" />
                    <AlertTitle>No `launch.json` Found</AlertTitle>
                    <AlertDescription>
                       You can run simple scripts using "Auto-detect", or create a `launch.json` file for more complex configurations.
                    </AlertDescription>
                    <Button onClick={handleAddLaunchJson} size="sm">
                        <FilePlus className="mr-2 h-4 w-4" />
                        Add launch.json
                    </Button>
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
                                            {config.type === 'auto' ? <BrainCircuit className="h-4 w-4" /> 
                                             : <PlayCircle className="h-4 w-4" />}
                                            <span>{config.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedConfig && selectedConfig.type !== 'auto' && (
                         <Alert variant="default">
                            <Settings2 className="h-4 w-4" />
                            <AlertTitle className="capitalize">{selectedConfig.type}</AlertTitle>
                            <AlertDescription>
                                {selectedConfig.program || selectedConfig.projectPath || selectedConfig.mainClass || 'Ready to launch in browser.'}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}
            
            {editorSettings.manualJsonInput && selectedConfig?.type !== 'synthesis' && selectedConfig?.type !== 'java-gui' && selectedConfig?.type !== 'auto' &&(
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
            
            <div className="grid grid-cols-2 gap-4">
                 <Button onClick={handleCompile} disabled={!isJavaConfig || isActionLoading} className="w-full">
                    {isActionLoading && isJavaConfig ? <LoaderCircle className="animate-spin" /> : <Hammer />}
                    Compile Java
                </Button>
                 <Button onClick={() => handleRun()} disabled={isActionLoading || !selectedConfigName || (isJavaConfig && !isProjectCompiled)} className="w-full">
                    {isActionLoading ? <LoaderCircle className="animate-spin" /> : <PlayCircle />}
                    Run
                </Button>
            </div>

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
                            <Label>stdout</Label>
                            <pre className="rounded-md border p-4 bg-muted font-mono text-sm whitespace-pre-wrap min-h-[50px]">
                                <code>{result.stdout || "No standard output."}</code>
                            </pre>
                        </div>
                    )}
                     {result.stderr && (
                        <div>
                            <Label className="text-destructive">stderr</Label>
                            <pre className="rounded-md border p-4 bg-destructive/10 text-destructive font-mono text-sm whitespace-pre-wrap min-h-[50px]">
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
