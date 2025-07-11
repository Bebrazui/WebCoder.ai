"use client";

import { useState, useEffect, useCallback } from "react";
import localforage from "localforage";
import JSZip from "jszip";
import type { VFSFile, VFSDirectory, VFSNode } from "@/lib/vfs";
import { createDirectory, createFile } from "@/lib/vfs";
import { useToast } from "./use-toast";

const VFS_KEY = "webcoder-vfs-root";

const defaultRoot: VFSDirectory = createDirectory("Project", "/");
defaultRoot.children.push(createFile(
    "welcome.md", 
    "/welcome.md", 
    `# Welcome to WebCoder.ai

This is a web-based code editor with AI capabilities.

**Features:**

*   **File Explorer:** Manage your files and folders on the left.
*   **ZIP Support:** Upload a .zip archive to unpack a project.
*   **File Upload:** Upload individual files.
*   **AI Code Transformer:** Select a piece of code, click the 'AI Transform' button, and tell the AI what to do!
*   **Persistence:** Your file system is saved in your browser, so it will be here when you come back.

Get started by uploading your files or a ZIP archive using the buttons in the explorer.
`
));

const isTextFile = (file: File) => {
    return file.type.startsWith('text/') ||
        /\.(json|js|jsx|ts|tsx|css|html|md|py|java|c|h|cpp|hpp|cs|go|php|rb|rs|swift|kt|yaml|yml|txt)$/i.test(file.name);
}

export function useVfs() {
  const [vfsRoot, setVfsRoot] = useState<VFSDirectory>(defaultRoot);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    localforage.config({
        name: 'WebCoderAI',
        storeName: 'vfs',
        description: 'Virtual File System for WebCoder.ai'
    });

    const loadVfs = async () => {
      try {
        const savedRoot = await localforage.getItem<VFSDirectory>(VFS_KEY);
        if (savedRoot && savedRoot.type === 'directory') {
          setVfsRoot(savedRoot);
        } else {
          // If no VFS, save the default one
          await localforage.setItem(VFS_KEY, defaultRoot);
        }
      } catch (error) {
        console.error("Failed to load VFS from IndexedDB", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load your project from local storage."});
      } finally {
        setLoading(false);
      }
    };
    loadVfs();
  }, [toast]);

  const saveVfs = useCallback(async (root: VFSDirectory) => {
    try {
      await localforage.setItem(VFS_KEY, root);
    } catch (error) {
      console.error("Failed to save VFS to IndexedDB", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save your project changes."});
    }
  }, [toast]);

  const findParentDir = (root: VFSDirectory, path: string): VFSDirectory | null => {
    const parts = path.split('/').filter(p => p);
    if (parts.length <= 1) return root;

    let currentDir: VFSDirectory = root;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextDir = currentDir.children.find(c => c.name === part && c.type === 'directory');
        if (nextDir && nextDir.type === 'directory') {
            currentDir = nextDir;
        } else {
            return null;
        }
    }
    return currentDir;
  }
  
  const addZipToVfs = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result;
        if (!content) return;
        
        setLoading(true);
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(content);
        const newRoot = createDirectory(file.name.replace('.zip', ''), '/');
        
        const promises = Object.keys(zip.files).map(async (relativePath) => {
            const zipEntry = zip.files[relativePath];
            if (relativePath.startsWith('__MACOSX/')) return; // Skip macOS metadata
            
            const pathParts = relativePath.split('/').filter(p => p);
            let currentDir = newRoot;

            for(let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                if (i === pathParts.length - 1 && !zipEntry.dir) { // It's a file
                    const fileContent = await zipEntry.async('base64');
                    const mime = `application/octet-stream`; // Default MIME type
                    const dataUri = `data:${mime};base64,${fileContent}`;
                    const newFile = createFile(part, `${currentDir.path === '/' ? '' : currentDir.path}/${part}`, dataUri);
                    currentDir.children.push(newFile);
                } else { // It's a directory
                    let dir = currentDir.children.find(c => c.name === part && c.type === 'directory') as VFSDirectory;
                    if (!dir) {
                        dir = createDirectory(part, `${currentDir.path === '/' ? '' : currentDir.path}/${part}`);
                        currentDir.children.push(dir);
                    }
                    currentDir = dir;
                }
            }
        });

        await Promise.all(promises);
        setVfsRoot(newRoot);
        saveVfs(newRoot);
        toast({ title: "ZIP unpacked", description: `Project ${newRoot.name} has been loaded.` });

      } catch (error) {
        console.error("Failed to unpack ZIP", error);
        toast({ variant: "destructive", title: "ZIP Error", description: "Could not unpack the ZIP archive." });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [saveVfs, toast]);

  const addFileToVfs = useCallback((file: File) => {
    // If it's a zip file, use the zip handler
    if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        addZipToVfs(file);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const newRoot = JSON.parse(JSON.stringify(vfsRoot));
      const newFile = createFile(file.name, `/${file.name}`, content);

      // Avoid duplicates
      const existingIndex = newRoot.children.findIndex((child: VFSNode) => child.name === file.name);
      if (existingIndex !== -1) {
          newRoot.children[existingIndex] = newFile;
      } else {
          newRoot.children.push(newFile);
      }
      
      setVfsRoot(newRoot);
      saveVfs(newRoot);
      toast({ title: "File uploaded", description: `${file.name} has been added to the project.` });
    };

    if (isTextFile(file)) {
        reader.readAsText(file);
    } else {
        reader.readAsDataURL(file);
    }
  }, [vfsRoot, saveVfs, toast, addZipToVfs]);

  const updateFileInVfs = useCallback((path: string, newContent: string): VFSFile | null => {
    const newRoot: VFSDirectory = JSON.parse(JSON.stringify(vfsRoot));
    const parentDir = findParentDir(newRoot, path);
    if (!parentDir) return null;
    
    const fileName = path.split('/').pop();
    const fileIndex = parentDir.children.findIndex(c => c.name === fileName && c.type === 'file');

    if (fileIndex > -1) {
        const fileToUpdate = parentDir.children[fileIndex] as VFSFile;
        // Don't update content if it's not a text file (to avoid replacing data URI with raw text)
        if (isTextFile({name: fileToUpdate.name, type: ''} as File)) {
            fileToUpdate.content = newContent;
        }
        setVfsRoot(newRoot);
        saveVfs(newRoot);
        return fileToUpdate;
    }
    return null;

  }, [vfsRoot, saveVfs]);

  return { vfsRoot, loading, addFileToVfs, addZipToVfs, updateFileInVfs };
}
