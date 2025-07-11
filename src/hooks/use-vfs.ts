
"use client";

import { useState, useEffect, useCallback } from "react";
import localforage from "localforage";
import JSZip from "jszip";
import type { VFSFile, VFSDirectory, VFSNode } from "@/lib/vfs";
import { createDirectory, createFile } from "@/lib/vfs";
import { useToast } from "./use-toast";
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import LightningFS from '@isomorphic-git/lightning-fs';
import { dataURIToArrayBuffer } from "@/lib/utils";


const VFS_KEY = "webcoder-vfs-root";
const GIT_FS_NAME = "webcoder-git-fs";
const GIT_DIR = '/';
const CORS_PROXY = 'https://cors.isomorphic-git.org';

const defaultRoot: VFSDirectory = createDirectory("Project", "/");
defaultRoot.children.push(createFile(
    "welcome.md", 
    "/welcome.md", 
    `# Welcome to WebCoder.ai

This is a web-based code editor with AI capabilities.

**Features:**

*   **GitHub Integration:** Clone public repositories directly from GitHub.
*   **File System Access API:** Open local folders directly (click "Folder" in the explorer).
*   **File Explorer:** Manage your files and folders on the left.
*   **ZIP Support:** Upload a .zip archive to unpack a project.
*   **File Upload:** Upload individual files.
*   **AI Code Transformer:** Select a piece of code, click the 'AI Transform' button, and tell the AI what to do!
*   **Persistence:** Your file system is saved in your browser, so it will be here when you come back.
*   **Drag & Drop:** Move files and folders around in the explorer.

**New:** Right-click on files/folders in the explorer to create, rename, or delete.

Get started by opening a local folder, or by uploading your files or a ZIP archive using the buttons in the explorer.
`
));

const isTextFile = (file: {name: string, type?: string, content?: string}) => {
    // Explicitly treat image/audio files as non-text
    if (/\.(png|jpg|jpeg|gif|webp|svg|mp3|wav|ogg|aac|flac|m4a)$/i.test(file.name)) {
        return false;
    }
    
    // Check data URI mime type if available
    if (file.content && file.content.startsWith('data:')) {
        const mime = file.content.substring(5, file.content.indexOf(';'));
        return mime.startsWith('text/') || !mime.includes('/');
    }
    
    // By default, assume it's a text file
    return true;
}


const findNodeAndParent = (root: VFSDirectory, path: string): { node: VFSNode; parent: VFSDirectory | null } | null => {
  const parts = path.split('/').filter(p => p);
  let currentDir: VFSDirectory = root;
  
  if (path === '/') return { node: root, parent: null };

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

// Initialize LightningFS
const fs = new LightningFS(GIT_FS_NAME);
const pfs = fs.promises;

export function useVfs() {
  const [vfsRoot, setVfsRoot] = useState<VFSDirectory>(defaultRoot);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [currentBranch, setCurrentBranch] = useState('main');

  const getGitBranch = useCallback(async () => {
    try {
        const branch = await git.currentBranch({ fs, dir: GIT_DIR });
        setCurrentBranch(branch || 'main');
    } catch (e) {
        // Not a git repository or other error
        setCurrentBranch('main');
        console.log("Could not get git branch", e);
    }
  }, []);

  const syncLfsToVfs = useCallback(async (): Promise<VFSDirectory> => {
      const readDir = async (dirPath: string): Promise<VFSNode[]> => {
          const entries = await pfs.readdir(dirPath);
          const nodes: VFSNode[] = [];
          for (const entry of entries) {
              if (entry === '.' || entry === '..') continue;

              const fullPath = `${dirPath === '/' ? '' : dirPath}/${entry}`;
              const stats = await pfs.stat(fullPath);
              const vfsPath = fullPath;
              
              if (stats.isDirectory()) {
                  const dirNode = createDirectory(entry, vfsPath);
                  dirNode.children = await readDir(fullPath);
                  nodes.push(dirNode);
              } else {
                  const content = await pfs.readFile(fullPath);
                  const newFile = createFile(entry, vfsPath, new TextDecoder().decode(content));
                  // Here we could try to detect binary files and convert to data URI
                  nodes.push(newFile);
              }
          }
          return nodes;
      };

      const repoName = vfsRoot.name || 'cloned-repo';
      const rootDir = createDirectory(repoName, '/');
      rootDir.children = await readDir('/');
      return rootDir;
  }, [vfsRoot.name]);


  const syncVfsToLfs = useCallback(async (root: VFSDirectory) => {
    try {
      // Clear existing fs
      const entries = await pfs.readdir('/');
      for (const entry of entries) {
        try {
          if (entry !== '.' && entry !== '..') {
            const stat = await pfs.stat(`/${entry}`);
            if (stat.isDirectory()) {
              await pfs.rmdir(`/${entry}`, { recursive: true });
            } else {
              await pfs.unlink(`/${entry}`);
            }
          }
        } catch (e) {
          if (e.code === 'ENOTEMPTY' || e.code === 'EPERM') {
             try {
                const subEntries = await pfs.readdir(`/${entry}`);
                for (const subEntry of subEntries) {
                    await pfs.unlink(`/${entry}/${subEntry}`);
                }
                await pfs.rmdir(`/${entry}`);
             } catch(e2) {
                 console.error("Failed to clean sub-directory", e2)
             }
          } else {
            console.error("Error clearing lightning-fs entry", e);
          }
        }
      }
    } catch(e) {
        console.error("Error clearing lightning-fs root", e);
    }
    
    const syncNode = async (node: VFSNode, pathPrefix: string = '') => {
        const currentPath = `${pathPrefix}/${node.name}`;
        if (node.type === 'directory') {
            await pfs.mkdir(currentPath, { recursive: true });
            for (const child of node.children) {
                await syncNode(child, currentPath);
            }
        } else if (node.type === 'file') {
            try {
              const content = node.content.startsWith('data:') 
                  ? dataURIToArrayBuffer(node.content)
                  : new TextEncoder().encode(node.content);
              await pfs.writeFile(currentPath, new Uint8Array(content));
            } catch (error) {
              console.error(`Failed to write file ${currentPath} to lightning-fs`, error);
            }
        }
    };
    // Sync children of the root to avoid a wrapping folder.
    for (const child of root.children) {
        await syncNode(child, '');
    }
  }, []);

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
          await syncVfsToLfs(savedRoot);
        } else {
          await localforage.setItem(VFS_KEY, defaultRoot);
          await syncVfsToLfs(defaultRoot);
        }
        await getGitBranch();
      } catch (error) {
        console.error("Failed to load VFS from IndexedDB", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load your project from local storage."});
      } finally {
        setLoading(false);
      }
    };
    
    if (!directoryHandle) {
      loadVfs();
    }
  }, [toast, directoryHandle, syncVfsToLfs, getGitBranch]);

  const saveVfs = useCallback(async (root: VFSDirectory) => {
    if (directoryHandle) {
        return;
    }
    try {
      await localforage.setItem(VFS_KEY, root);
      await syncVfsToLfs(root);
      await getGitBranch();
    } catch (error) {
      console.error("Failed to save VFS to IndexedDB", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save your project changes."});
    }
  }, [toast, directoryHandle, syncVfsToLfs, getGitBranch]);
  
  const addZipToVfs = useCallback((file: File) => {
    setDirectoryHandle(null); // When a zip is uploaded, we switch off FS API mode.
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
                    // A simple heuristic to guess mime type from extension
                    const getMimeType = (fileName: string) => {
                      const ext = fileName.split('.').pop()?.toLowerCase();
                      switch(ext) {
                        case 'txt': return 'text/plain';
                        case 'html': return 'text/html';
                        case 'css': return 'text/css';
                        case 'js': return 'application/javascript';
                        case 'json': return 'application/json';
                        case 'png': return 'image/png';
                        case 'jpg':
                        case 'jpeg':
                          return 'image/jpeg';
                        case 'gif': return 'image/gif';
                        case 'svg': return 'image/svg+xml';
                        case 'mp3': return 'audio/mpeg';
                        case 'wav': return 'audio/wav';
                        case 'ogg': return 'audio/ogg';
                        case 'aac': return 'audio/aac';
                        case 'flac': return 'audio/flac';
                        case 'm4a': return 'audio/mp4';
                        default: return 'application/octet-stream';
                      }
                    }
                    const mime = getMimeType(part);
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
    setDirectoryHandle(null); // When a file is uploaded, we switch off FS API mode.

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setVfsRoot(currentRoot => {
        const newRoot = JSON.parse(JSON.stringify(currentRoot));
        const parentDirResult = findNodeAndParent(newRoot, parent.path);
        
        if (parentDirResult && parentDirResult.node.type === 'directory') {
          const targetDir = parentDirResult.node;
          const newPath = targetDir.path === '/' ? `/${file.name}` : `${targetDir.path}/${file.name}`;
          
          if (targetDir.children.some((c: VFSNode) => c.name === file.name)) {
            toast({ variant: "destructive", title: "Error", description: `A file named "${file.name}" already exists.`});
            return currentRoot;
          }

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
    
    if (isTextFile({name: file.name, type: file.type})) {
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
            result.node.content = newContent;
            updatedFile = result.node;
            // Note: We don't save here anymore to support dirty states
            return newRoot;
        }
        return currentRoot;
    });
    return updatedFile;
  }, []);

  const saveFileToVfs = useCallback(async (file: VFSFile) => {
    if (directoryHandle) {
        try {
            const pathParts = file.path.split('/').filter(p => p);
            let currentHandle: FileSystemDirectoryHandle | FileSystemFileHandle = directoryHandle;

            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                if (currentHandle.kind === 'directory') {
                    if (i === pathParts.length - 1) { // file handle
                        currentHandle = await currentHandle.getFileHandle(part);
                    } else { // directory handle
                        currentHandle = await currentHandle.getDirectoryHandle(part);
                    }
                }
            }

            if (currentHandle.kind === 'file') {
                const writable = await currentHandle.createWritable();
                await writable.write(file.content);
                await writable.close();
                toast({ title: "File Saved", description: `${file.name} has been saved to disk.`});
            }
        } catch (error) {
            console.error("Failed to save file to disk:", error);
            toast({ variant: "destructive", title: "Save Error", description: "Could not save file to your computer."});
        }
    } else {
        // Fallback to localforage if no directory is open
        setVfsRoot(currentRoot => {
            const newRoot = JSON.parse(JSON.stringify(currentRoot));
            const result = findNodeAndParent(newRoot, file.path);
            if (result && result.node.type === 'file') {
                result.node.content = file.content;
                saveVfs(newRoot); // This now persists the changes
                toast({ title: "File Saved", description: `${file.name} has been saved.`});
                return newRoot;
            }
            return currentRoot;
        });
    }
  }, [saveVfs, toast, directoryHandle]);

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
        
        // Recursively update children paths if it's a directory
        const updateChildrenPaths = (dir: VFSNode, newParentPath: string) => {
          dir.path = newParentPath === '/' ? `/${dir.name}`: `${newParentPath}/${dir.name}`;
          if (dir.type === 'directory') {
            dir.children.forEach(child => {
              updateChildrenPaths(child, dir.path);
            });
          }
        };
        
        nodeToRename.name = newName;
        const parentPath = result.parent.path;
        updateChildrenPaths(nodeToRename, parentPath);
        newPath = nodeToRename.path;
        
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

  const moveNodeInVfs = useCallback((sourcePath: string, targetDirPath: string): {newPath: string} | null => {
    let newPath: string | null = null;
    setVfsRoot(currentRoot => {
        const newRoot = JSON.parse(JSON.stringify(currentRoot));
        const sourceResult = findNodeAndParent(newRoot, sourcePath);
        const targetResult = findNodeAndParent(newRoot, targetDirPath);

        if (!sourceResult || !sourceResult.parent || !targetResult || targetResult.node.type !== 'directory') {
            toast({ variant: 'destructive', title: 'Move Error', description: "Invalid source or target." });
            return currentRoot;
        }

        const targetDir = targetResult.node;
        const nodeToMove = sourceResult.node;

        if (targetDir.children.some(c => c.name === nodeToMove.name)) {
            toast({ variant: 'destructive', title: 'Move Error', description: `A file or folder named "${nodeToMove.name}" already exists in the target directory.` });
            return currentRoot;
        }
        
        // Remove from old parent
        const sourceIndex = sourceResult.parent.children.findIndex(c => c.path === sourcePath);
        sourceResult.parent.children.splice(sourceIndex, 1);

        // Add to new parent and update paths
        const oldPath = nodeToMove.path;
        const updatePaths = (node: VFSNode, newParentPath: string) => {
            node.path = newParentPath === '/' ? `/${node.name}` : `${newParentPath}/${node.name}`;
            if (node.type === 'directory') {
                node.children.forEach(child => updatePaths(child, node.path));
            }
        }

        updatePaths(nodeToMove, targetDir.path);
        newPath = nodeToMove.path;
        targetDir.children.push(nodeToMove);
        
        saveVfs(newRoot);
        toast({ title: 'Moved', description: `Moved "${nodeToMove.name}"` });
        return newRoot;
    });

    return newPath ? { newPath } : null;
  }, [saveVfs, toast]);

  const openFolderWithApi = useCallback(async (): Promise<boolean> => {
    try {
        const handle = await window.showDirectoryPicker();
        setDirectoryHandle(handle);
        setLoading(true);

        const processHandle = async (currentHandle: FileSystemDirectoryHandle | FileSystemFileHandle, path: string): Promise<VFSNode | null> => {
            if (currentHandle.kind === 'file') {
                const file = await currentHandle.getFile();
                const content = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    if (isTextFile({name: file.name, type: file.type})) {
                        reader.readAsText(file);
                    } else {
                        reader.readAsDataURL(file);
                    }
                });
                return createFile(currentHandle.name, path, content);
            }
            if (currentHandle.kind === 'directory') {
                const dir = createDirectory(currentHandle.name, path);
                const children: VFSNode[] = [];
                for await (const entry of currentHandle.values()) {
                    const childPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
                    const childNode = await processHandle(entry, childPath);
                    if (childNode) {
                        children.push(childNode);
                    }
                }
                dir.children = children;
                return dir;
            }
            return null;
        }

        const newRoot = await processHandle(handle, '/');
        if (newRoot && newRoot.type === 'directory') {
            newRoot.name = handle.name; // Use the actual directory name for the root
            setVfsRoot(newRoot);
            await syncVfsToLfs(newRoot);
            await getGitBranch();
            toast({ title: "Folder opened", description: `Opened "${handle.name}" successfully.`});
            return true;
        }
        return false;

    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            // User cancelled the picker, do nothing.
        } else {
            console.error("File System Access API error:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not open folder. Your browser might not support this feature."});
        }
        return false;
    } finally {
        setLoading(false);
    }
  }, [toast, syncVfsToLfs, getGitBranch]);

  const downloadVfsAsZip = useCallback(async () => {
    const zip = new JSZip();

    const addNodeToZip = (node: VFSNode, zipFolder: JSZip) => {
      if (node.type === 'file') {
        const content = node.content.startsWith('data:') 
          ? node.content.split(',')[1] 
          : node.content;
        const isBase64 = node.content.startsWith('data:');
        zipFolder.file(node.name, content, { base64: isBase64 });
      } else if (node.type === 'directory') {
        const folder = zipFolder.folder(node.name);
        if (folder) {
          node.children.forEach(child => addNodeToZip(child, folder));
        }
      }
    };
    
    // We add the root's children, not the root itself, to avoid a wrapping folder
    vfsRoot.children.forEach(child => addNodeToZip(child, zip));

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${vfsRoot.name || 'project'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: 'Success', description: 'Your project is downloading.' });
    } catch (error) {
      console.error('Failed to create ZIP:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not create the ZIP file.' });
    }
  }, [vfsRoot, toast]);

  const cloneRepository = useCallback(async (url: string): Promise<boolean> => {
    setLoading(true);
    setDirectoryHandle(null);
    const repoName = url.split('/').pop()?.replace('.git', '') || 'cloned-repo';
    toast({ title: 'Cloning...', description: `Cloning ${repoName}...` });

    try {
        await git.clone({
            fs,
            http,
            dir: GIT_DIR,
            url,
            corsProxy: CORS_PROXY,
            singleBranch: true,
            depth: 10,
        });

        const newRoot = await syncLfsToVfs();
        newRoot.name = repoName;

        setVfsRoot(newRoot);
        await saveVfs(newRoot);
        
        await getGitBranch();
        
        toast({ title: 'Clone successful', description: `Repository ${repoName} cloned.` });
        return true;
    } catch (e) {
        console.error("Clone failed", e);
        toast({ variant: 'destructive', title: 'Clone failed', description: e.message });
        return false;
    } finally {
        setLoading(false);
    }
  }, [toast, getGitBranch, saveVfs, syncLfsToVfs]);


  return { 
    vfsRoot, 
    loading,
    currentBranch,
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
  };
}
