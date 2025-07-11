
"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import hotkeys from "hotkeys-js";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  SidebarHeader
} from "@/components/ui/sidebar";
import { SidebarView } from "./sidebar-view";
import { EditorPane } from "./editor-pane";
import { StatusBar } from "./status-bar";
import { useVfs } from "@/hooks/use-vfs";
import type { VFSFile, VFSNode, VFSDirectory } from "@/lib/vfs";
import { Skeleton } from "./ui/skeleton";
import { CommandPalette } from "./command-palette";
import { MenuBar } from "./menu-bar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";

const TerminalView = dynamic(
  () => import('./terminal').then(mod => mod.TerminalView),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full" />,
  }
);


export function Ide() {
  const { 
    vfsRoot, 
    loading, 
    currentBranch,
    gitStatus,
    isGitStatusLoading,
    commit,
    addFileToVfs, 
    addZipToVfs, 
    updateFileInVfs,
    saveFileToVfs,
    createFileInVfs,
    createDirectoryInVfs,
    renameNodeInVfs,
    deleteNodeInVfs,
    moveNodeInVfs,
    openFolderWithApi,
    downloadVfsAsZip,
    cloneRepository,
  } = useVfs();
  const [openFiles, setOpenFiles] = useState<VFSFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  
  const handleSelectFile = useCallback((file: VFSFile) => {
    if (!openFiles.some((f) => f.path === file.path)) {
       const findFile = (root: VFSDirectory, path: string): VFSFile | null => {
         for (const child of root.children) {
           if (child.path === path && child.type === 'file') return child;
           if (child.type === 'directory') {
             const found = findFile(child, path);
             if (found) return found;
           }
         }
         return null;
       }
       const fileFromVfs = findFile(vfsRoot, file.path);
       if (fileFromVfs) {
          setOpenFiles((prev) => [...prev, fileFromVfs]);
       }
    }
    setActiveFilePath(file.path);
  }, [openFiles, vfsRoot]);


  const handleFileChange = useCallback((path: string, newContent: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content: newContent } : f))
    );
    setDirtyFiles(prev => new Set(prev).add(path));
    updateFileInVfs(path, newContent);
  }, [updateFileInVfs]);

  const handleSaveFile = useCallback((path: string | null) => {
    const filePathToSave = path || activeFilePath;
    if (!filePathToSave) return;

    const fileToSave = openFiles.find(f => f.path === filePathToSave);
    if (fileToSave) {
      saveFileToVfs(fileToSave);
      setDirtyFiles(prev => {
        const newDirtyFiles = new Set(prev);
        newDirtyFiles.delete(filePathToSave);
        return newDirtyFiles;
      });
    }
  }, [openFiles, activeFilePath, saveFileToVfs]);

  useEffect(() => {
    hotkeys('ctrl+s, command+s', (event) => {
      event.preventDefault();
      handleSaveFile(null);
    });

    hotkeys('ctrl+k, command+k', (event) => {
      event.preventDefault();
      setIsCommandPaletteOpen(prev => !prev);
    });
    
    hotkeys('ctrl+`, command+`', (event) => {
      event.preventDefault();
      setIsTerminalOpen(prev => !prev);
    });

    return () => {
        hotkeys.unbind('ctrl+s, command+s');
        hotkeys.unbind('ctrl+k, command+k');
        hotkeys.unbind('ctrl+`, command+`');
    }
  }, [handleSaveFile]);


  const handleFileClose = useCallback((path: string) => {
    const isDirty = dirtyFiles.has(path);
    if(isDirty && !confirm("You have unsaved changes. Are you sure you want to close this file?")) {
        return;
    }

    const fileIndex = openFiles.findIndex((f) => f.path === path);
    if (fileIndex === -1) return;

    const newOpenFiles = openFiles.filter((f) => f.path !== path);
    setOpenFiles(newOpenFiles);
    
    setDirtyFiles(prev => {
      const newDirtyFiles = new Set(prev);
      newDirtyFiles.delete(path);
      return newDirtyFiles;
    });

    if (activeFilePath === path) {
      if (newOpenFiles.length > 0) {
        const newActiveIndex = Math.max(0, fileIndex - 1);
        setActiveFilePath(newOpenFiles[newActiveIndex].path);
      } else {
        setActiveFilePath(null);
      }
    }
  }, [openFiles, activeFilePath, dirtyFiles]);
  
  const handleRenameNode = (node: VFSNode, newName: string) => {
    const oldPath = node.path;
    const newPath = renameNodeInVfs(node, newName);

    if (newPath) {
      setOpenFiles(prevOpenFiles => {
        return prevOpenFiles.map(file => {
          if (file.path === oldPath && node.type === 'file') {
            return { ...file, path: newPath, name: newName };
          }
          if (file.path.startsWith(oldPath + '/') && node.type === 'directory') {
            const updatedPath = newPath + file.path.substring(oldPath.length);
            return { ...file, path: updatedPath };
          }
          return file;
        });
      });

       if(dirtyFiles.has(oldPath)) {
        setDirtyFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(oldPath);
          newSet.add(newPath);
          return newSet;
        });
      }

      if (activeFilePath === oldPath && node.type === 'file') {
        setActiveFilePath(newPath);
      } else if (activeFilePath && activeFilePath.startsWith(oldPath + '/') && node.type === 'directory') {
        setActiveFilePath(newPath + activeFilePath.substring(oldPath.length));
      }
    }
  };

  const handleDeleteNode = (node: VFSNode) => {
    const pathsToDelete = node.type === 'file' ? [node.path] : 
      openFiles.filter(f => f.path.startsWith(node.path + '/')).map(f => f.path);
    
    pathsToDelete.forEach(path => {
       const fileIndex = openFiles.findIndex((f) => f.path === path);
        if (fileIndex === -1) return;

        const newOpenFiles = openFiles.filter((f) => f.path !== path);
        setOpenFiles(newOpenFiles);
        
        setDirtyFiles(prev => {
          const newDirtyFiles = new Set(prev);
          newDirtyFiles.delete(path);
          return newDirtyFiles;
        });

        if (activeFilePath === path) {
          if (newOpenFiles.length > 0) {
            const newActiveIndex = Math.max(0, fileIndex - 1);
            setActiveFilePath(newOpenFiles[newActiveIndex].path);
          } else {
            setActiveFilePath(null);
          }
        }
    });

    deleteNodeInVfs(node);
  }

  const handleMoveNode = (sourcePath: string, targetDirPath: string) => {
    const result = moveNodeInVfs(sourcePath, targetDirPath);
    if (!result) return;
    
    const { newPath } = result;
    
    setOpenFiles(prev => prev.map(file => {
      if (file.path === sourcePath) {
        return {...file, path: newPath };
      }
      if (file.path.startsWith(sourcePath + '/')) {
        return { ...file, path: newPath + file.path.substring(sourcePath.length) };
      }
      return file;
    }));

    if (dirtyFiles.has(sourcePath)) {
        setDirtyFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(sourcePath);
            newSet.add(newPath);
            return newSet;
        });
    }

    if (activeFilePath === sourcePath) {
        setActiveFilePath(newPath);
    } else if (activeFilePath?.startsWith(sourcePath + '/')) {
        setActiveFilePath(newPath + activeFilePath.substring(sourcePath.length));
    }
  };

  const resetEditorState = () => {
      setOpenFiles([]);
      setActiveFilePath(null);
      setDirtyFiles(new Set());
  }

  const handleOpenFolder = async () => {
    const success = await openFolderWithApi();
    if (success) {
      resetEditorState();
    }
  }

  const handleCloneRepo = async (url: string) => {
    const success = await cloneRepository(url);
    if (success) {
      resetEditorState();
    }
    return success;
  }

  const handleNewFile = () => {
    const name = prompt("Enter new file name:");
    if (name) {
      createFileInVfs(name, vfsRoot);
    }
  };
  
  const handleNewFolder = () => {
    const name = prompt("Enter new folder name:");
    if (name) {
      createDirectoryInVfs(name, vfsRoot);
    }
  };

  const activeFile = openFiles.find(f => f.path === activeFilePath) || null;
  const isFileDirty = activeFile ? dirtyFiles.has(activeFile.path) : false;

  return (
    <SidebarProvider>
      <div className="h-screen w-screen bg-background text-foreground grid grid-rows-[auto_1fr_auto]">
        <MenuBar 
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onOpenFolder={handleOpenFolder}
          onSaveFile={() => handleSaveFile(null)}
          onDownloadZip={downloadVfsAsZip}
          onCommandPaletteToggle={() => setIsCommandPaletteOpen(true)}
        />
        <div className="flex min-h-0">
            <Sidebar>
                <SidebarHeader className="md:hidden flex justify-between">
                    <h2 className="text-lg font-headline font-semibold">Explorer</h2>
                    <SidebarTrigger />
                </SidebarHeader>
                <SidebarContent className="p-0">
                  <SidebarView 
                    vfsRoot={vfsRoot}
                    loading={loading}
                    gitStatus={gitStatus}
                    isGitStatusLoading={isGitStatusLoading}
                    onCommit={commit}
                    onSelectFile={handleSelectFile}
                    onUploadFile={addFileToVfs}
                    onUploadZip={addZipToVfs}
                    onNewFile={createFileInVfs}
                    onNewFolder={createDirectoryInVfs}
                    onRenameNode={handleRenameNode}
                    onDeleteNode={handleDeleteNode}
                    onMoveNode={handleMoveNode}
                    onOpenFolder={handleOpenFolder}
                    onDownloadZip={downloadVfsAsZip}
                    onCloneRepository={handleCloneRepo}
                  />
                </SidebarContent>
            </Sidebar>
          
            <main className="flex-1 flex flex-col min-w-0 h-full">
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={isTerminalOpen ? 65 : 100} minSize={20}>
                  <EditorPane
                      openFiles={openFiles}
                      activeFilePath={activeFilePath}
                      dirtyFiles={dirtyFiles}
                      onFileSelect={setActiveFilePath}
                      onFileChange={handleFileChange}
                      onFileClose={handleFileClose}
                      onFileSave={handleSaveFile}
                  />
                </ResizablePanel>
                {isTerminalOpen && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={35} minSize={10}>
                      <TerminalView />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </main>
        </div>
        <StatusBar 
            activeFile={activeFile} 
            isDirty={isFileDirty}
            branch={currentBranch}
            onTerminalToggle={() => setIsTerminalOpen(prev => !prev)}
            isTerminalOpen={isTerminalOpen} 
            onCommandPaletteToggle={() => setIsCommandPaletteOpen(true)}
          />
        <CommandPalette 
          isOpen={isCommandPaletteOpen}
          setIsOpen={setIsCommandPaletteOpen}
          vfsRoot={vfsRoot}
          onSelectFile={handleSelectFile}
          onToggleTerminal={() => setIsTerminalOpen(p => !p)}
        />
      </div>
    </SidebarProvider>
  );
}
