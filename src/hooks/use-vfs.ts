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

**New:** Right-click on files/folders in the explorer to create, rename, or delete.

Get started by uploading your files or a ZIP archive using the buttons in the explorer.
`
));

const isTextFile = (file: {name: string, type?: string}) => {
    // Check MIME type first if available
    if (file.type?.startsWith('text/')) {
        return true;
    }
    // Fallback to file extension for broader text-like file matching
    return /\.(json|js|jsx|ts|tsx|css|html|md|py|java|c|h|cpp|hpp|cs|go|php|rb|rs|swift|kt|yaml|yml|txt|gitignore|env|bat|sh|xml|svg)$/i.test(file.name);
}


const findNodeAndParent = (root: VFSDirectory, path: string): { node: VFSNode; parent: VFSDirectory } | null => {
  const parts = path.split('/').filter(p => p);
  let currentDir: VFSDirectory = root;
  
  if (path === '/') return { node: root, parent: root };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const node = currentDir.children.find(c => c.name === part);

    if (!node) return null;

    if (i === parts.length - 1) {
      return { node, parent: currentDir };
    }

    if (node.type === 'directory') {
      currentDir = node;
    } else {
      return null;
    }
  }
  return null;
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
            if (zipEntry.dir || relativePath.startsWith('__MACOSX/')) return;

            const pathParts = relativePath.split('/').filter(p => p);
            let currentDir = newRoot;

            for(let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                const isFile = i === pathParts.length - 1;

                if (!isFile) { // It's a directory
                    let dir = currentDir.children.find(c => c.name === part && c.type === 'directory') as VFSDirectory;
                    if (!dir) {
                        const dirPath = currentDir.path === '/' ? `/${part}` : `${currentDir.path}/${part}`;
                        dir = createDirectory(part, dirPath);
                        currentDir.children.push(dir);
                    }
                    currentDir = dir;
                } else { // It's a file
                    const fileContent = await zipEntry.async('base64');
                    const mime = 'application/octet-stream';
                    const dataUri = `data:${mime};base64,${fileContent}`;
                    const newPath = currentDir.path === '/' ? `/${part}` : `${currentDir.path}/${part}`;
                    const newFile = createFile(part, newPath, dataUri);
                    currentDir.children.push(newFile);
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

  const addFileToVfs = useCallback((file: File, parent: VFSDirectory) => {
    if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        addZipToVfs(file);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setVfsRoot(currentRoot => {
        const newRoot = JSON.parse(JSON.stringify(currentRoot));
        const parentDirResult = findNodeAndParent(newRoot, parent.path);
        
        if (parentDirResult && parentDirResult.node.type === 'directory') {
          const targetDir = parentDirResult.node;
          const newPath = targetDir.path === '/' ? `/${file.name}` : `${targetDir.path}/${file.name}`;
          const newFile = createFile(file.name, newPath, content);

          const existingIndex = targetDir.children.findIndex((child: VFSNode) => child.name === file.name);
          if (existingIndex !== -1) {
            targetDir.children[existingIndex] = newFile;
          } else {
            targetDir.children.push(newFile);
          }
          saveVfs(newRoot);
          toast({ title: "File uploaded", description: `${file.name} has been added.` });
          return newRoot;
        }
        return currentRoot;
      });
    };

    if (isTextFile(file)) {
        reader.readAsText(file);
    } else {
        reader.readAsDataURL(file);
    }
  }, [saveVfs, toast, addZipToVfs]);

  const updateFileInVfs = useCallback((path: string, newContent: string): VFSFile | null => {
    let updatedFile: VFSFile | null = null;
    setVfsRoot(currentRoot => {
        const newRoot = JSON.parse(JSON.stringify(currentRoot));
        const result = findNodeAndParent(newRoot, path);

        if (result && result.node.type === 'file') {
            if (!result.node.content.startsWith('data:') || isTextFile(result.node)) {
              result.node.content = newContent;
            }
            updatedFile = result.node;
            saveVfs(newRoot);
            return newRoot;
        }
        return currentRoot;
    });
    return updatedFile;
  }, [saveVfs]);

  const createFileInVfs = useCallback((name: string, parent: VFSDirectory) => {
    setVfsRoot(currentRoot => {
      const newRoot = JSON.parse(JSON.stringify(currentRoot));
      const parentDirResult = findNodeAndParent(newRoot, parent.path);
      
      if (parentDirResult && parentDirResult.node.type === 'directory') {
        const targetDir = parentDirResult.node;
        if (targetDir.children.some(c => c.name === name)) {
          toast({ variant: 'destructive', title: 'Error', description: `File "${name}" already exists.` });
          return currentRoot;
        }
        const newPath = targetDir.path === '/' ? `/${name}` : `${targetDir.path}/${name}`;
        const newFile = createFile(name, newPath, '');
        targetDir.children.push(newFile);
        saveVfs(newRoot);
        toast({ title: 'File created', description: `Created ${name}` });
        return newRoot;
      }
      return currentRoot;
    });
  }, [saveVfs, toast]);

  const createDirectoryInVfs = useCallback((name: string, parent: VFSDirectory) => {
    setVfsRoot(currentRoot => {
      const newRoot = JSON.parse(JSON.stringify(currentRoot));
      const parentDirResult = findNodeAndParent(newRoot, parent.path);
      
      if (parentDirResult && parentDirResult.node.type === 'directory') {
        const targetDir = parentDirResult.node;
        if (targetDir.children.some(c => c.name === name)) {
          toast({ variant: 'destructive', title: 'Error', description: `"${name}" already exists.` });
          return currentRoot;
        }
        const newPath = targetDir.path === '/' ? `/${name}` : `${targetDir.path}/${name}`;
        const newDir = createDirectory(name, newPath);
        targetDir.children.push(newDir);
        saveVfs(newRoot);
        toast({ title: 'Directory created', description: `Created ${name}` });
        return newRoot;
      }
      return currentRoot;
    });
  }, [saveVfs, toast]);

  const renameNodeInVfs = useCallback((node: VFSNode, newName: string): string | null => {
    let newPath: string | null = null;
    setVfsRoot(currentRoot => {
      const newRoot = JSON.parse(JSON.stringify(currentRoot));
      const result = findNodeAndParent(newRoot, node.path);
      
      if (result && result.parent) {
        if (result.parent.children.some(c => c.name === newName && c.path !== node.path)) {
          toast({ variant: 'destructive', title: 'Error', description: `"${newName}" already exists.` });
          return currentRoot;
        }

        const nodeToRename = result.parent.children.find(c => c.path === node.path)!;
        const oldPath = nodeToRename.path;
        const pathParts = oldPath.split('/');
        pathParts[pathParts.length - 1] = newName;
        newPath = pathParts.join('/');
        nodeToRename.name = newName;
        nodeToRename.path = newPath;

        // Recursively update children paths if it's a directory
        const updateChildrenPaths = (dir: VFSDirectory) => {
          dir.children.forEach(child => {
            const childName = child.path.substring(dir.path.lastIndexOf('/') + 1);
            child.path = dir.path === '/' ? `/${child.name}` : `${dir.path}/${child.name}`;
            if (child.type === 'directory') {
              updateChildrenPaths(child);
            }
          });
        };
        
        if (nodeToRename.type === 'directory') {
          updateChildrenPaths(nodeToRename);
        }

        saveVfs(newRoot);
        toast({ title: 'Renamed', description: `"${node.name}" is now "${newName}"` });
        return newRoot;
      }
      return currentRoot;
    });
    return newPath;
  }, [saveVfs, toast]);

  const deleteNodeInVfs = useCallback((node: VFSNode) => {
    setVfsRoot(currentRoot => {
      const newRoot = JSON.parse(JSON.stringify(currentRoot));
      const result = findNodeAndParent(newRoot, node.path);

      if (result && result.parent && node.path !== '/') {
        const index = result.parent.children.findIndex(c => c.path === node.path);
        if (index > -1) {
          result.parent.children.splice(index, 1);
          saveVfs(newRoot);
          toast({ title: 'Deleted', description: `Removed "${node.name}"` });
          return newRoot;
        }
      }
      return currentRoot;
    });
  }, [saveVfs, toast]);


  return { 
    vfsRoot, 
    loading, 
    addFileToVfs, 
    addZipToVfs, 
    updateFileInVfs,
    createFileInVfs,
    createDirectoryInVfs,
    renameNodeInVfs,
    deleteNodeInVfs,
  };
}
