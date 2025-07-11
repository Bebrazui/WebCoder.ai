"use client";

import { useState, useEffect, useCallback } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { FileExplorer } from "./file-explorer";
import { EditorPane } from "./editor-pane";
import { StatusBar } from "./status-bar";
import { useVfs } from "@/hooks/use-vfs";
import type { VFSFile, VFSNode, VFSDirectory } from "@/lib/vfs";
import { Button } from "./ui/button";

export function Ide() {
  const { 
    vfsRoot, 
    loading, 
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
  } = useVfs();
  const [openFiles, setOpenFiles] = useState<VFSFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());

  const handleSelectFile = useCallback((file: VFSFile) => {
    // Check if the file is already open by comparing its path.
    // The content in openFiles might be different if it's dirty.
    if (!openFiles.some((f) => f.path === file.path)) {
       // Find the latest version from VFS to open.
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
    // Update content in the open file state
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content: newContent } : f))
    );
    // Mark file as dirty
    setDirtyFiles(prev => new Set(prev).add(path));
    // Also update the content in the main VFS state but don't save to storage
    updateFileInVfs(path, newContent);
  }, [updateFileInVfs]);

  const handleSaveFile = useCallback((path: string) => {
    const fileToSave = openFiles.find(f => f.path === path);
    if (fileToSave) {
      saveFileToVfs(fileToSave);
      setDirtyFiles(prev => {
        const newDirtyFiles = new Set(prev);
        newDirtyFiles.delete(path);
        return newDirtyFiles;
      });
    }
  }, [openFiles, saveFileToVfs]);

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
      // If the renamed node was an open file or a directory containing open files, update their paths
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

       // Update dirty files set
      if(dirtyFiles.has(oldPath)) {
        setDirtyFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(oldPath);
          newSet.add(newPath);
          return newSet;
        });
      }

      // Update active file path if it was the renamed file
      if (activeFilePath === oldPath && node.type === 'file') {
        setActiveFilePath(newPath);
      } else if (activeFilePath && activeFilePath.startsWith(oldPath + '/') && node.type === 'directory') {
        setActiveFilePath(newPath + activeFilePath.substring(oldPath.length));
      }
    }
  };

  const handleDeleteNode = (node: VFSNode) => {
    // Close any files that are being deleted
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
    
    // Update paths for open files
    setOpenFiles(prev => prev.map(file => {
      if (file.path === sourcePath) { // it's the moved file itself
        return {...file, path: newPath };
      }
      if (file.path.startsWith(sourcePath + '/')) { // it's a file inside a moved directory
        return { ...file, path: newPath + file.path.substring(sourcePath.length) };
      }
      return file;
    }));

    // Update dirty files set
    if (dirtyFiles.has(sourcePath)) {
        setDirtyFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(sourcePath);
            newSet.add(newPath);
            return newSet;
        });
    }

    // Update active file path
    if (activeFilePath === sourcePath) {
        setActiveFilePath(newPath);
    } else if (activeFilePath?.startsWith(sourcePath + '/')) {
        setActiveFilePath(newPath + activeFilePath.substring(sourcePath.length));
    }
  };

  const handleOpenFolder = async () => {
    const success = await openFolderWithApi();
    if (success) {
      // Reset editor state
      setOpenFiles([]);
      setActiveFilePath(null);
      setDirtyFiles(new Set());
    }
  }

  const activeFile = openFiles.find(f => f.path === activeFilePath) || null;
  const isFileDirty = activeFile ? dirtyFiles.has(activeFile.path) : false;

  return (
    <div className="h-screen w-screen bg-background text-foreground flex">
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarContent>
            <FileExplorer 
              vfsRoot={vfsRoot}
              loading={loading}
              onSelectFile={handleSelectFile}
              onUploadFile={addFileToVfs}
              onUploadZip={addZipToVfs}
              onNewFile={createFileInVfs}
              onNewFolder={createDirectoryInVfs}
              onRenameNode={handleRenameNode}
              onDeleteNode={handleDeleteNode}
              onMoveNode={handleMoveNode}
              onOpenFolder={handleOpenFolder}
            />
          </SidebarContent>
        </Sidebar>
        <div className="flex-1 flex flex-col min-w-0 h-full">
            <header className="flex items-center gap-2 p-2 border-b shrink-0">
                <SidebarTrigger />
                <h1 className="font-headline font-semibold text-lg tracking-tight">WebCoder.ai</h1>
            </header>
            <main className="flex-1 p-4 min-h-0">
                <EditorPane
                    openFiles={openFiles}
                    activeFilePath={activeFilePath}
                    dirtyFiles={dirtyFiles}
                    onFileSelect={setActiveFilePath}
                    onFileChange={handleFileChange}
                    onFileClose={handleFileClose}
                    onFileSave={handleSaveFile}
                />
            </main>
            <StatusBar activeFile={activeFile} isDirty={isFileDirty} />
        </div>
      </SidebarProvider>
    </div>
  );
}
