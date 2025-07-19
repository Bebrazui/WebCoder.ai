// src/components/file-explorer.tsx
"use client";

import React, { useState, useRef, useMemo, useCallback, createContext, useContext } from "react";
import { type VFSNode, type VFSDirectory, type VFSFile, isImageFile } from "@/lib/vfs";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Edit,
  Trash2,
  FolderSearch,
  Search,
  X,
  Download,
  Github,
  Play,
  Copy,
  Atom
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { GlobalSearch } from "./global-search";
import { CloneRepositoryDialog } from "./clone-repository-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { FileIcon } from "./file-icon";
import { useToast } from "@/hooks/use-toast";


export interface LaunchConfig {
    name: string;
    type: string;
    request: 'launch';
    program?: string;
    mainClass?: string;
    projectPath?: string;
    platform?: 'ios' | 'android' | 'windows' | 'macos' | 'linux';
    cargo?: {
        args: string[];
        projectPath: string;
    };
    [key: string]: any;
}

export interface FileExplorerProps {
  vfsRoot: VFSDirectory;
  loading: boolean;
  onSelectFile: (file: VFSFile) => void;
  onUploadFile: (file: File, parent: VFSDirectory) => void;
  onUploadZip: (file: File) => void;
  onNewFile: (name: string, parent: VFSDirectory) => void;
  onNewFolder: (name: string, parent: VFSDirectory) => void;
  onRenameNode: (node: VFSNode, newName: string) => void;
  onDeleteNode: (node: VFSNode) => void;
  onMoveNode: (sourcePath: string, targetDirPath: string) => void;
  onOpenFolder: () => void;
  onDownloadZip: () => void;
  onCloneRepository: (url: string) => Promise<boolean>;
  launchConfigs: LaunchConfig[];
  findFileByPath: (path: string) => VFSFile | null;
  createFileInVfs: (name: string, parent: VFSDirectory, content?: string) => void;
}

const ExplorerContext = createContext<{ 
  clearDragState: () => void;
  findFileByPath: (path: string) => VFSFile | null;
  createFileInVfs: (name: string, parent: VFSDirectory, content?: string) => void;
  vfsRoot: VFSDirectory;
  onSelectFile: (file: VFSFile) => void;
} | null>(null);

const useExplorerContext = () => {
    const context = useContext(ExplorerContext);
    if (!context) {
        throw new Error("useExplorerContext must be used within a FileExplorer");
    }
    return context;
};

export function FileExplorer({
  vfsRoot,
  loading,
  onSelectFile,
  onUploadFile,
  onUploadZip,
  onNewFile,
  onNewFolder,
  onRenameNode,
  onDeleteNode,
  onMoveNode,
  onOpenFolder,
  onDownloadZip,
  onCloneRepository,
  launchConfigs,
  findFileByPath,
  createFileInVfs,
}: FileExplorerProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [dragVersion, setDragVersion] = useState(0);

  const clearDragState = () => {
      setDragVersion(v => v + 1);
  };

  const handleNewFileAtRoot = () => {
    const name = prompt("Enter new file name:");
    if (name) {
      onNewFile(name, vfsRoot);
    }
  };

  const handleNewFolderAtRoot = () => {
    const name = prompt("Enter new folder name:");
    if (name) {
      onNewFolder(name, vfsRoot);
    }
  };

  return (
    <ExplorerContext.Provider value={{ clearDragState, findFileByPath, createFileInVfs, vfsRoot, onSelectFile }}>
      <Collapsible open={isSearchOpen} onOpenChange={setIsSearchOpen} className="flex flex-col h-full bg-background text-foreground">
        <div className="p-2 border-b border-border">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-headline font-semibold">Explorer</h2>
              <TooltipProvider>
                <div className="flex items-center">
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewFileAtRoot}><FilePlus className="h-4 w-4" /></Button></TooltipTrigger>
                        <TooltipContent><p>New File</p></TooltipContent>
                    </Tooltip>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewFolderAtRoot}><FolderPlus className="h-4 w-4" /></Button></TooltipTrigger>
                        <TooltipContent><p>New Folder</p></TooltipContent>
                    </Tooltip>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDownloadZip}><Download className="h-4 w-4" /></Button></TooltipTrigger>
                        <TooltipContent><p>Download as ZIP</p></TooltipContent>
                    </Tooltip>
                    <CollapsibleTrigger asChild>
                      <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                {isSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                              </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Toggle Search</p></TooltipContent>
                      </Tooltip>
                    </CollapsibleTrigger>
                </div>
              </TooltipProvider>
            </div>
        </div>
        
        <CollapsibleContent>
          <div className="border-b border-border">
            <GlobalSearch vfsRoot={vfsRoot} onSelectFile={onSelectFile} />
          </div>
        </CollapsibleContent>

        <ScrollArea className="flex-grow" onClick={clearDragState}>
          <ContextMenu>
            <ContextMenuTrigger className="block h-full w-full">
              <div className="p-2 text-sm h-full">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-5/6 ml-4" />
                    <Skeleton className="h-6 w-4/6" />
                    <Skeleton className="h-6 w-5/6 ml-4" />
                    <Skeleton className="h-6 w-3/6 ml-4" />
                  </div>
                ) : vfsRoot.children.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>No files in project.</p>
                  </div>
                ) : (
                  <ExplorerNode 
                    node={vfsRoot} 
                    level={0}
                    onNewFile={onNewFile}
                    onNewFolder={onNewFolder}
                    onRenameNode={onRenameNode}
                    onDeleteNode={onDeleteNode}
                    onMoveNode={onMoveNode}
                    launchConfigs={launchConfigs}
                    dragVersion={dragVersion}
                  />
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={handleNewFileAtRoot}>
                  <FilePlus className="mr-2 h-4 w-4" /> New File
                </ContextMenuItem>
                <ContextMenuItem onClick={handleNewFolderAtRoot}>
                  <FolderPlus className="mr-2 h-4 w-4" /> New Folder
                </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </ScrollArea>
      </Collapsible>
      <CloneRepositoryDialog 
        open={isCloneDialogOpen} 
        onOpenChange={setIsCloneDialogOpen}
        onClone={onCloneRepository}
      />
    </ExplorerContext.Provider>
  );
}

const ExplorerNode = ({
  node,
  level,
  onNewFile,
  onNewFolder,
  onRenameNode,
  onDeleteNode,
  onMoveNode,
  launchConfigs,
  dragVersion,
}: {
  node: VFSNode;
  level: number;
  onNewFile: (name: string, parent: VFSDirectory) => void;
  onNewFolder: (name: string, parent: VFSDirectory) => void;
  onRenameNode: (node: VFSNode, newName: string) => void;
  onDeleteNode: (node: VFSNode) => void;
  onMoveNode: (sourcePath: string, targetDirPath: string) => void;
  launchConfigs: LaunchConfig[];
  dragVersion: number;
}) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const [isDragOver, setIsDragOver] = useState(false);
  const { vfsRoot, findFileByPath, createFileInVfs, clearDragState, onSelectFile } = useExplorerContext();
  const { toast } = useToast();

  React.useEffect(() => {
    setIsDragOver(false);
  }, [dragVersion]);
  
  const normalizePath = (p: string) => {
    let path = p;
    if (path.startsWith('./')) path = path.substring(2);
    if (path.startsWith('/')) path = path.substring(1);
    return path;
  };
  
  const runnableConfig = useMemo(() => {
    if (node.type !== 'file') return null;
    const filePath = normalizePath(node.path);
    
    return launchConfigs.find(config => {
      if (config.type === 'synthesis') return false; // Handled separately
      const program = config.program ? normalizePath(config.program) : null;
      if (program && program === filePath) return true;
      if (config.type === 'java' && node.name === `${config.mainClass}.java`) return true;
      if (config.type === 'rust' && node.name === 'main.rs' && config.cargo?.projectPath && filePath.startsWith(normalizePath(config.cargo.projectPath))) return true;
      if (config.type === 'csharp' && node.name === 'Program.cs' && config.projectPath && filePath.startsWith(normalizePath(config.projectPath))) return true;
      return false;
    });
  }, [node, launchConfigs]);

  const handleAddLaunchJson = useCallback(() => {
      const content = `{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Java App",
      "type": "java",
      "request": "launch",
      "mainClass": "Main",
      "sourcePaths": ["java_apps/src"],
      "classPaths": [],
      "args": {
        "name": "Java User",
        "age": 42
      }
    },
    {
      "name": "Run Python Script",
      "type": "python",
      "request": "launch",
      "program": "python_scripts/my_script.py",
      "args": {
        "name": "From launch.json",
        "value": 12345
      }
    }
  ]
}
`;
      createFileInVfs('launch.json', vfsRoot, content);
      toast({ title: '`launch.json` created', description: 'File was added to the root of your project. You can now run your script.' });
  }, [createFileInVfs, vfsRoot, toast]);
  
  const handleRunScript = useCallback(async (config: LaunchConfig | null) => {
    if (!config) {
        const launchFile = findFileByPath('launch.json');
        if (window.confirm(`No launch configuration found for this file. Would you like to open 'launch.json' to add one?`)) {
            if (launchFile) {
                onSelectFile(launchFile);
            } else {
                handleAddLaunchJson();
            }
        }
        return;
    }

    toast({ title: "Running script...", description: `Executing '${config.name}'... Check the Run & Debug view for output.`});
    const apiEndpoint = `/api/run-${config.type}`;
    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectFiles: [vfsRoot],
                config: config,
            }),
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error);
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: `Execution Failed: ${config.name}`, description: e.message });
    }
  }, [findFileByPath, handleAddLaunchJson, toast, vfsRoot, onSelectFile]);


  const paddingLeft = `${level * 1}rem`;

  const handleRename = () => {
    const newName = prompt(`Enter new name for ${node.name}:`, node.name);
    if (newName && newName !== node.name) {
      onRenameNode(node, newName);
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${node.name}?`)) {
      onDeleteNode(node);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (node.path === '/') return;
    e.dataTransfer.setData("text/plain", node.path);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.type === 'directory') {
      setIsDragOver(true);
    }
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    clearDragState();
    
    if(node.type !== 'directory') return;
    
    const sourcePath = e.dataTransfer.getData("text/plain");
    const targetDirPath = node.path;
    
    if (!sourcePath || sourcePath === targetDirPath || targetDirPath.startsWith(sourcePath + '/')) {
        return;
    }
    onMoveNode(sourcePath, targetDirPath);
  };


  if (node.type === "directory") {
    const handleNewFile = () => {
      const name = prompt("Enter new file name:");
      if (name) {
        onNewFile(name, node as VFSDirectory);
      }
    };

    const handleNewFolder = () => {
      const name = prompt("Enter new folder name:");
      if (name) {
        onNewFolder(name, node as VFSDirectory);
      }
    };


    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <div 
             onDragOver={handleDragOver}
             onDragLeave={handleDragLeave}
             onDrop={handleDrop}
             onDragEnd={clearDragState}
             className={cn('rounded-md', isDragOver && 'bg-accent/50')}
          >
            <div
              draggable={node.path !== '/'}
              onDragStart={handleDragStart}
              className="flex items-center p-1 rounded-md cursor-pointer hover:bg-accent"
              style={{ paddingLeft }}
              onClick={() => setIsOpen(!isOpen)}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 mr-1 transition-transform",
                  isOpen && "rotate-90"
                )}
              />
              {isOpen ? (
                <FolderOpen className="h-4 w-4 mr-2 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 mr-2 text-blue-500" />
              )}
              <span className="truncate">{node.name}</span>
            </div>
            {isOpen && (
              <div>
                {node.children.length > 0 ? (
                    node.children
                        .slice()
                        .sort((a,b) => {
                            if (a.type === 'directory' && b.type === 'file') return -1;
                            if (a.type === 'file' && b.type === 'directory') return 1;
                            return a.name.localeCompare(b.name);
                        })
                        .map((child) => (
                            <ExplorerNode
                                key={child.path}
                                node={child}
                                level={level + 1}
                                onNewFile={onNewFile}
                                onNewFolder={onNewFolder}
                                onRenameNode={onRenameNode}
                                onDeleteNode={onDeleteNode}
                                onMoveNode={onMoveNode}
                                launchConfigs={launchConfigs}
                                dragVersion={dragVersion}
                            />
                    ))
                ) : (
                    level > 0 && <p className="p-1 text-muted-foreground" style={{ paddingLeft: `${(level + 1) * 1}rem` }}>
                        empty
                    </p>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleNewFile}>
            <FilePlus className="mr-2 h-4 w-4" /> New File
          </ContextMenuItem>
          <ContextMenuItem onClick={handleNewFolder}>
            <FolderPlus className="mr-2 h-4 w-4" /> New Folder
          </ContextMenuItem>
          {level > 0 && <ContextMenuSeparator />}
          {level > 0 && <ContextMenuItem onClick={handleRename}>
            <Edit className="mr-2 h-4 w-4" /> Rename
          </ContextMenuItem>}
          {level > 0 && <ContextMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </ContextMenuItem>}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  const isSynthesisFile = node.name.endsWith('.syn');

  const handleBuildSynthesis = () => {
    const config: LaunchConfig = {
      name: `Build ${node.name}`,
      type: 'synthesis',
      request: 'launch',
      program: node.path,
      platform: 'ios' // Default platform for direct build
    };
    handleRunScript(config);
  }

  const handleCopyBase64 = () => {
    if (node.type === 'file' && isImageFile(node.name) && node.content.startsWith('data:')) {
        const base64Content = node.content.split(',')[1];
        navigator.clipboard.writeText(base64Content);
        toast({ title: 'Copied!', description: 'Base64 content copied to clipboard.' });
    }
  };

  return (
    <ContextMenu>
        <ContextMenuTrigger>
            <div
                draggable
                onDragStart={handleDragStart}
                onDragEnd={clearDragState}
                className="flex items-center p-1 rounded-md cursor-pointer hover:bg-accent"
                style={{ paddingLeft }}
                onClick={() => onSelectFile(node)}
            >
                <FileIcon filename={node.name} className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{node.name}</span>
            </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isSynthesisFile && (
            <>
                <ContextMenuItem onClick={handleBuildSynthesis}>
                    <Atom className="mr-2 h-4 w-4" /> Build SYNTHESIS App
                </ContextMenuItem>
                <ContextMenuSeparator />
            </>
        )}
        {runnableConfig !== null && (
            <>
                <ContextMenuItem onClick={() => handleRunScript(runnableConfig || null)}>
                    <Play className="mr-2 h-4 w-4" /> Run Script
                </ContextMenuItem>
                <ContextMenuSeparator />
            </>
        )}
        {isImageFile(node.name) && (
            <ContextMenuItem onClick={handleCopyBase64}>
                <Copy className="mr-2 h-4 w-4" /> Copy as Base64
            </ContextMenuItem>
        )}
        <ContextMenuItem onClick={handleRename}>
          <Edit className="mr-2 h-4 w-4" /> Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
