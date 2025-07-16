// src/components/ide.tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import hotkeys from "hotkeys-js";
import type * as monaco from "monaco-editor";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sidebar } from "./sidebar-view";
import { EditorPane } from "./editor-pane";
import { StatusBar } from "./status-bar";
import { useVfs, type VfsHook } from "@/hooks/use-vfs";
import type { VFSFile, VFSNode, VFSDirectory } from "@/lib/vfs";
import { Skeleton } from "./ui/skeleton";
import { CommandPalette } from "./command-palette";
import { MenuBar } from "./menu-bar";
import { useToast } from "@/hooks/use-toast";
import type { OutlineData } from "./outline-view";
import { SettingsSheet } from "./settings-sheet";
import { useAppState } from "@/hooks/use-app-state";


const TerminalView = dynamic(
  () => import('./terminal').then(mod => mod.TerminalView),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full" />,
  }
);

interface IdeProps {
    vfs: VfsHook;
}

export function Ide({ vfs }: IdeProps) {
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
    findFileByPath,
    compileJavaProject,
    createNoCodeHProject,
  } = vfs;
  const [openFiles, setOpenFiles] = useState<VFSFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isStatusBarVisible, setIsStatusBarVisible] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [outlineData, setOutlineData] = useState<OutlineData[]>([]);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { toast } = useToast();
  const { editorSettings } = useAppState();

  const resetEditorState = useCallback(() => {
      setOpenFiles([]);
      setActiveFilePath(null);
      setDirtyFiles(new Set());
  }, []);
  
  const handleSelectFile = useCallback((file: VFSFile) => {
    if (!openFiles.some((f) => f.path === file.path)) {
       const fileFromVfs = findFileByPath(file.path);
       if (fileFromVfs) {
          setOpenFiles((prev) => [...prev, fileFromVfs]);
       }
    }
    setActiveFilePath(file.path);
  }, [openFiles, findFileByPath]);


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

  const handleSaveAll = useCallback(() => {
    const dirtyPaths = Array.from(dirtyFiles);
    if (dirtyPaths.length === 0) {
        toast({ title: "No files to save", description: "All changes are already saved." });
        return;
    }
    dirtyPaths.forEach(path => {
        const fileToSave = openFiles.find(f => f.path === path);
        if (fileToSave) {
            saveFileToVfs(fileToSave);
        }
    });
    setDirtyFiles(new Set());
    toast({ title: "All Files Saved", description: `${dirtyPaths.length} file(s) have been saved.`});
  }, [dirtyFiles, openFiles, saveFileToVfs, toast]);

  const triggerEditorAction = (actionId: string) => {
    editorRef.current?.focus();
    editorRef.current?.trigger('menu-bar', actionId, null);
  };

  useEffect(() => {
    hotkeys('ctrl+s, command+s', (event) => {
      event.preventDefault();
      handleSaveFile(null);
    });

    hotkeys('ctrl+shift+s, command+shift+s', (event) => {
        event.preventDefault();
        handleSaveAll();
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
        hotkeys.unbind('ctrl+shift+s, command+shift+s');
        hotkeys.unbind('ctrl+k, command+k');
        hotkeys.unbind('ctrl+`, command+`');
    }
  }, [handleSaveFile, handleSaveAll]);


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

  const handleCloseAllFiles = useCallback(() => {
    const hasDirtyFiles = dirtyFiles.size > 0;
    if (hasDirtyFiles && !confirm("You have unsaved changes in some files. Are you sure you want to close them all?")) {
        return;
    }
    setOpenFiles([]);
    setActiveFilePath(null);
    setDirtyFiles(new Set());
  }, [dirtyFiles.size]);
  
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

  const handleSymbolSelect = useCallback((range: monaco.IRange) => {
    editorRef.current?.revealRangeInCenter(range, monaco.editor.ScrollType.Smooth);
    editorRef.current?.focus();
  }, []);

  return (
    <div className="h-screen w-full bg-background text-foreground grid grid-rows-[auto_1fr_auto]">
      <MenuBar 
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onOpenFolder={handleOpenFolder}
        onSaveFile={() => handleSaveFile(null)}
        onSaveAllFiles={handleSaveAll}
        onCloseFile={() => activeFilePath && handleFileClose(activeFilePath)}
        onCloseAllFiles={handleCloseAllFiles}
        onDownloadZip={downloadVfsAsZip}
        onCommandPaletteToggle={() => setIsCommandPaletteOpen(true)}
        onEditorAction={triggerEditorAction}
        isSidebarVisible={isSidebarVisible}
        onToggleSidebar={() => setIsSidebarVisible(p => !p)}
        isTerminalVisible={isTerminalOpen}
        onToggleTerminal={() => setIsTerminalOpen(p => !p)}
        isStatusBarVisible={isStatusBarVisible}
        onToggleStatusBar={() => setIsStatusBarVisible(p => !p)}
      />
      
      <main className="min-h-0">
        <ResizablePanelGroup direction="horizontal">
          {isSidebarVisible && (
            <>
              <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
                <Sidebar
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
                  outlineData={outlineData}
                  onSymbolSelect={handleSymbolSelect}
                  onCompileJava={compileJavaProject}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          <ResizablePanel defaultSize={isSidebarVisible ? 80 : 100}>
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
                    onEditorReady={(editor) => { editorRef.current = editor }}
                    onOutlineChange={setOutlineData}
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>

      {isStatusBarVisible && (
          <StatusBar 
              activeFile={activeFile} 
              isDirty={isFileDirty}
              branch={currentBranch}
              onTerminalToggle={() => setIsTerminalOpen(prev => !prev)}
              isTerminalOpen={isTerminalOpen} 
              onCommandPaletteToggle={() => setIsCommandPaletteOpen(true)}
            />
      )}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        setIsOpen={setIsCommandPaletteOpen}
        onSelectFile={handleSelectFile}
        onToggleTerminal={() => setIsTerminalOpen(p => !p)}
      />
      <SettingsSheet />
    </div>
  );
}
