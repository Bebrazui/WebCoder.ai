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
    createFileInVfs,
    createDirectoryInVfs,
    renameNodeInVfs,
    deleteNodeInVfs,
  } = useVfs();
  const [openFiles, setOpenFiles] = useState<VFSFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const handleSelectFile = useCallback((file: VFSFile) => {
    if (!openFiles.some((f) => f.path === file.path)) {
      setOpenFiles((prev) => [...prev, file]);
    }
    setActiveFilePath(file.path);
  }, [openFiles]);

  const handleFileChange = useCallback((path: string, newContent: string) => {
    // Update VFS
    const updatedFile = updateFileInVfs(path, newContent);
    if (!updatedFile) return;

    // Update open files state
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content: newContent } : f))
    );
  }, [updateFileInVfs]);

  const handleFileClose = useCallback((path: string) => {
    const fileIndex = openFiles.findIndex((f) => f.path === path);
    if (fileIndex === -1) return;

    const newOpenFiles = openFiles.filter((f) => f.path !== path);
    setOpenFiles(newOpenFiles);

    if (activeFilePath === path) {
      if (newOpenFiles.length > 0) {
        // Activate the previous tab, or the first one if it was the first
        const newActiveIndex = Math.max(0, fileIndex - 1);
        setActiveFilePath(newOpenFiles[newActiveIndex].path);
      } else {
        setActiveFilePath(null);
      }
    }
  }, [openFiles, activeFilePath]);
  
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
    
    pathsToDelete.forEach(path => handleFileClose(path));

    // If deleting the active file, handle it.
    if(node.type === 'file' && activeFilePath === node.path) {
        // handleFileClose already logic for setting new active tab
    }
    
    deleteNodeInVfs(node);
  }

  const activeFile = openFiles.find(f => f.path === activeFilePath) || null;

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
                    onFileSelect={setActiveFilePath}
                    onFileChange={handleFileChange}
                    onFileClose={handleFileClose}
                />
            </main>
            <StatusBar activeFile={activeFile} />
        </div>
      </SidebarProvider>
    </div>
  );
}
