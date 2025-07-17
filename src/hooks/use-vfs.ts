// src/hooks/use-vfs.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import localforage from "localforage";
import JSZip from "jszip";
import type { VFSFile, VFSDirectory, VFSNode } from "@/lib/vfs";
import { createDirectory, createFile, isTextFile as isTextFileUtil } from "@/lib/vfs";
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
*   **File Upload:** Upload individual files or ZIP archives.
*   **AI Code Transformer:** Select a piece of code, click the 'AI Transform' button, and tell the AI what to do!
*   **Persistence:** Your file system is saved in your browser, so it will be here when you come back.
*   **Drag & Drop:** Move files and folders around in the explorer.
*   **Open With:** The installed desktop application can be used to open files/folders from your OS.

**New:** Right-click on files/folders in the explorer to create, rename, or delete.

Get started by opening a local folder, or by uploading your files.
`
));

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

export type GitStatus = {
    filepath: string;
    status: 'new' | 'modified' | 'deleted' | 'unmodified';
};

export type VfsHook = ReturnType<typeof useVfs>;


export function useVfs() {
  const [vfsRoot, setVfsRoot] = useState<VFSDirectory>(defaultRoot);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [gitStatus, setGitStatus] = useState<GitStatus[]>([]);
  const [isGitStatusLoading, setIsGitStatusLoading] = useState(false);
  const isOpeningFolder = useRef(false);

  const getGitStatus = useCallback(async () => {
    setIsGitStatusLoading(true);
    try {
      const matrix = await git.statusMatrix({ fs, dir: GIT_DIR });

      const detailedStatuses = matrix.map(([filepath, head, workdir, stage]) => {
        if (workdir === 0) return { filepath, status: 'deleted' as const };
        if (head === 0 && workdir > 0) return { filepath, status: 'new' as const };
        if (stage === 0) return { filepath, status: 'modified' as const };
        if (head > 0 && workdir > 0 && head !== workdir) return { filepath, status: 'modified' as const };
        
        return { filepath, status: 'unmodified' as const };
      }).filter((s) => s.status !== 'unmodified');
        
        setGitStatus(detailedStatuses);
    } catch (e) {
        setGitStatus([]);
    } finally {
        setIsGitStatusLoading(false);
    }
  }, []);


  const getGitBranch = useCallback(async () => {
    try {
        const branch = await git.currentBranch({ fs, dir: GIT_DIR, fullname: false });
        setCurrentBranch(branch || 'main');
    } catch (e) {
        setCurrentBranch('main');
    }
  }, []);

  const syncLfsToVfs = useCallback(async (): Promise<VFSDirectory> => {
      const readDir = async (dirPath: string): Promise<VFSNode[]> => {
          const entries = await pfs.readdir(dirPath);
          const nodes: VFSNode[] = [];
          for (const entry of entries) {
              if (entry === '.' || entry === '..' || entry === '.git') continue;

              const fullPath = `${dirPath === '/' ? '' : dirPath}/${entry}`;
              const stats = await pfs.stat(fullPath);
              const vfsPath = fullPath;
              
              if (stats.isDirectory()) {
                  const dirNode = createDirectory(entry, vfsPath);
                  dirNode.children = await readDir(fullPath);
                  nodes.push(dirNode);
              } else {
                  try {
                    const contentBuffer = await pfs.readFile(fullPath);
                    const newFile = createFile(entry, vfsPath, new TextDecoder().decode(contentBuffer));
                    nodes.push(newFile);
                  } catch (e) {
                    console.error(`Could not read file ${fullPath} from LFS`, e);
                  }
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
        const entries = await pfs.readdir('/');
        for(const entry of entries) {
            if (entry === '.' || entry === '..') continue;
            const path = `/${entry}`;
            try {
                await pfs.unlink(path);
            } catch {
                await pfs.rmdir(path, { recursive: true });
            }
        }
    } catch (e) {
    }

    const syncNode = async (node: VFSNode, parentPath: string) => {
        if (node.name === '.git') return;

        const currentPath = parentPath === '/' ? `/${node.name}` : `${parentPath}/${node.name}`;
        
        if (node.type === 'directory') {
            try {
                await pfs.stat(currentPath);
            } catch (e) {
                await pfs.mkdir(currentPath, { recursive: true });
            }
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

    for (const child of root.children) {
        await syncNode(child, '/');
    }
  }, []);

  const saveVfs = useCallback(async (root: VFSDirectory, options: { silent?: boolean } = {}) => {
    if (directoryHandle) {
        return;
    }
    try {
      await localforage.setItem(VFS_KEY, root);
      await syncVfsToLfs(root);
      await getGitStatus();
    } catch (error) {
      console.error("Failed to save VFS to IndexedDB", error);
      if (!options.silent) {
        toast({ variant: "destructive", title: "Save Error", description: "Could not save project." });
      }
    }
  }, [directoryHandle, syncVfsToLfs, getGitStatus, toast]);

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
          setVfsRoot(defaultRoot);
          await saveVfs(defaultRoot, { silent: true });
        }
        await getGitBranch();
        await getGitStatus();
      } catch (error) {
        console.error("Failed to load VFS from IndexedDB", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load your project from local storage."});
        setVfsRoot(defaultRoot);
        await saveVfs(defaultRoot, { silent: true });
      } finally {
        setLoading(false);
      }
    };
    
    if (!directoryHandle) {
      loadVfs();
    }
  }, [directoryHandle]);
  
  const addZipToVfs = useCallback((file: File) => {
    setDirectoryHandle(null);

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

                if (!isFile) {
                    let dir = currentDir.children.find(c => c.name === part && c.type === 'directory') as VFSDirectory;
                    if (!dir) {
                        const dirPath = currentDir.path === '/' ? `/${part}` : `${currentDir.path}/${part}`;
                        dir = createDirectory(part, dirPath);
                        currentDir.children.push(dir);
                    }
                    currentDir = dir;
                } else {
                    const fileIsText = isTextFileUtil({name: part});
                    let fileContent: string;
                    if (fileIsText) {
                        fileContent = await zipEntry.async('text');
                    } else {
                        const base64Content = await zipEntry.async('base64');
                        const mime = 'application/octet-stream';
                        fileContent = `data:${mime};base64,${base64Content}`;
                    }
                    const newPath = currentDir.path === '/' ? `/${part}` : `${currentDir.path}/${part}`;
                    const newFile = createFile(part, newPath, fileContent);
                    currentDir.children.push(newFile);
                }
            }
        });

        await Promise.all(promises);
        setVfsRoot(newRoot);
        await saveVfs(newRoot);
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
    setDirectoryHandle(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setVfsRoot(currentRoot => {
        const newRoot = JSON.parse(JSON.stringify(currentRoot));
        const parentDirResult = findNodeAndParent(newRoot, parent.path);
        
        if (parentDirResult && parentDirResult.node.type === 'directory') {
          const targetDir = parentDirResult.node;
          
          if (targetDir.children.some((c: VFSNode) => c.name === file.name)) {
            toast({ variant: "destructive", title: "Error", description: `A file named "${file.name}" already exists.`});
            return currentRoot;
          }

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
    
    if (isTextFileUtil({name: file.name})) {
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
                    if (i === pathParts.length - 1) {
                        currentHandle = await currentHandle.getFileHandle(part);
                    } else {
                        currentHandle = await currentHandle.getDirectoryHandle(part);
                    }
                }
            }

            if (currentHandle.kind === 'file') {
                const writable = await currentHandle.createWritable();
                await writable.write(file.content);
                await writable.close();
                getGitStatus();
                toast({ title: "File Saved", description: `${file.name} has been saved to disk.`});
            }
        } catch (error) {
            console.error("Failed to save file to disk:", error);
            toast({ variant: "destructive", title: "Save Error", description: "Could not save file to your computer."});
        }
    } else {
        setVfsRoot(currentRoot => {
            const newRoot = JSON.parse(JSON.stringify(currentRoot));
            const result = findNodeAndParent(newRoot, file.path);
            if (result && result.node.type === 'file') {
                result.node.content = file.content;
                saveVfs(newRoot);
                toast({ title: "File Saved", description: `${file.name} has been saved.`});
                return newRoot;
            }
            return currentRoot;
        });
    }
  }, [saveVfs, toast, directoryHandle, getGitStatus]);

  const createFileInVfs = useCallback((name: string, parent: VFSDirectory, content: string = '') => {
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
        const newFile = createFile(name, newPath, content);
        targetDir.children.push(newFile);
        saveVfs(newRoot);
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
        const newRoot = { ...currentRoot };
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
        
        const sourceIndex = sourceResult.parent.children.findIndex(c => c.path === sourcePath);
        sourceResult.parent.children.splice(sourceIndex, 1);

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

  const processHandle = useCallback(async (handle: FileSystemDirectoryHandle | FileSystemFileHandle, path: string): Promise<VFSNode | null> => {
      if (handle.kind === 'file') {
          const file = await handle.getFile();
          const content = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              if (isTextFileUtil({name: file.name})) {
                  reader.readAsText(file);
              } else {
                  reader.readAsDataURL(file);
              }
          });
          return createFile(handle.name, path, content);
      }
      if (handle.kind === 'directory') {
          const dir = createDirectory(handle.name, path);
          const children: VFSNode[] = [];
          for await (const entry of handle.values()) {
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
  }, []);

  const openFolderWithApi = useCallback(async (): Promise<boolean> => {
    if (isOpeningFolder.current) return false;
    isOpeningFolder.current = true;
    try {
        const handle = await window.showDirectoryPicker();
        setDirectoryHandle(handle);
        setLoading(true);
        const newRoot = await processHandle(handle, '/');
        if (newRoot && newRoot.type === 'directory') {
            newRoot.name = handle.name;
            setVfsRoot(newRoot);
            await syncVfsToLfs(newRoot);
            await getGitBranch();
            await getGitStatus();
            toast({ title: "Folder opened", description: `Opened "${handle.name}" successfully.`});
            return true;
        }
        return false;
    } catch (error) {
        if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {} 
        else { console.error("File System Access API error:", error); toast({ variant: "destructive", title: "Error", description: "Could not open folder."}); }
        return false;
    } finally {
        setLoading(false);
        isOpeningFolder.current = false;
    }
  }, [toast, syncVfsToLfs, getGitBranch, getGitStatus, processHandle]);

  const openPathWithApi = useCallback(async (path: string): Promise<boolean> => {
     try {
       toast({ title: 'Open With is not fully implemented', description: 'Please use "Open Folder" for now.' });
       return false;
     } catch (e) {
       console.error(e);
       toast({ variant: 'destructive', title: 'Error Opening Path', description: 'Could not open the specified path.' });
       return false;
     }
  }, [toast]);

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
        await fs.init(GIT_FS_NAME, { wipe: true });
    } catch (e) {
    }
    
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
        await getGitStatus();
        
        toast({ title: 'Clone successful', description: `Repository ${repoName} cloned.` });
        return true;
    } catch (e: any) {
        console.error("Clone failed", e);
        toast({ variant: 'destructive', title: 'Clone failed', description: e.message || 'An unknown error occurred during clone.' });
        return false;
    } finally {
        setLoading(false);
    }
  }, [toast, getGitBranch, getGitStatus, saveVfs, syncLfsToVfs]);

  const commit = useCallback(async (message: string, token: string) => {
    const matrix = await git.statusMatrix({ fs, dir: GIT_DIR });

    for (const [filepath, head, workdir] of matrix) {
        if (filepath === '.') continue;
        if (workdir === 0) {
            await git.remove({ fs, dir: GIT_DIR, filepath });
        } else if (head === 0 || workdir > 0) {
            await git.add({ fs, dir: GIT_DIR, filepath });
        }
    }

    const sha = await git.commit({
        fs,
        dir: GIT_DIR,
        message,
        author: {
            name: 'WebCoder.ai',
            email: 'bot@webcoder.ai',
        },
    });
    
    toast({ title: 'Committed!', description: `Changes committed with SHA: ${sha.substring(0, 7)}`});
    
    try {
        if (!token) {
            toast({ variant: "destructive", title: 'Push Skipped', description: 'Please provide a GitHub token to push changes.' });
            return;
        }

        toast({ title: 'Pushing...', description: 'Attempting to push changes to the remote repository.'});

        const pushResult = await git.push({
            fs,
            http,
            dir: GIT_DIR,
            corsProxy: CORS_PROXY,
            onAuth: () => ({ username: token }),
        });
        
        if (pushResult.ok) {
           toast({ title: 'Push successful!', description: 'Your changes have been pushed to the remote repository.'});
        } else {
           throw new Error(pushResult.errors?.join('\n') || 'Unknown push error');
        }

    } catch (e: any) {
        console.error("Push failed", e);
        toast({ variant: 'destructive', title: 'Push Failed', description: e.message || 'An unknown error occurred during push.' });
    } finally {
        await getGitStatus();
    }
  }, [getGitStatus, toast]);

  const findNodeByPath = useCallback((path: string): VFSNode | null => {
    if (path === '/') return vfsRoot;
    const search = (node: VFSNode): VFSNode | null => {
        if (node.path === path) {
            return node;
        }
        if (node.type === 'directory') {
            for (const child of node.children) {
                const found = search(child);
                if (found) return found;
            }
        }
        return null;
    }
    return search(vfsRoot);
  }, [vfsRoot]);
  
  const findFileByPath = useCallback((path: string): VFSFile | null => {
    const node = findNodeByPath(path);
    return node?.type === 'file' ? node : null;
  }, [findNodeByPath]);

  const compileJavaProject = useCallback(async (): Promise<boolean> => {
    toast({ title: "Compiling Java Project...", description: "This may take a moment." });
    try {
        const response = await fetch('/api/compile-java', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectFiles: [vfsRoot],
                config: { sourcePaths: ['.'] }
            }),
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error);
        }

        const buildFolder = data.data.buildOutput as VFSDirectory;
        
        setVfsRoot(currentRoot => {
            const newRoot = JSON.parse(JSON.stringify(currentRoot));
            const existingBuildIndex = newRoot.children.findIndex((c:VFSNode) => c.name === 'build' && c.type === 'directory');
            if (existingBuildIndex !== -1) {
                newRoot.children[existingBuildIndex] = buildFolder;
            } else {
                newRoot.children.push(buildFolder);
            }
            saveVfs(newRoot);
            toast({ title: "Compilation Successful", description: "The 'build' directory has been created/updated." });
            return newRoot;
        });
        return true;
    } catch (error: any) {
        console.error("Compilation failed:", error);
        toast({ variant: "destructive", title: "Compilation Failed", description: error.message });
        return false;
    }
  }, [vfsRoot, toast, saveVfs]);
  
  const createNoCodeHProject = useCallback(() => {
    const newRoot = createDirectory("NoCodeH Game", "/");
    newRoot.children.push(createFile('.nocodeh', '/.nocodeh', 'This file marks the directory as a NoCodeH project.'));
    newRoot.children.push(createFile('README.md', '/README.md', '# NoCodeH Game Project\n\nThis project was created with the WebCoder.ai No-Code Game Editor.\n\nOpen `/nocode` in your browser to start editing.'));

    setVfsRoot(newRoot);
    saveVfs(newRoot);
    toast({ title: "NoCodeH Project Created", description: "Your new game project is ready." });
    window.location.href = '/nocode';
  }, [saveVfs, toast]);

  const createBlankProject = useCallback(() => {
    const newRoot = createDirectory("Blank Project", "/");
    newRoot.children.push(createFile(
        "README.md", 
        "/README.md", 
        `# My Blank Project

Start adding your files here!`
    ));
    setVfsRoot(newRoot);
    saveVfs(newRoot);
    toast({ title: "Blank Project Created", description: "A new empty project has been initialized." });
  }, [saveVfs, toast]);

  const exitProject = useCallback(() => {
    setVfsRoot(defaultRoot);
    saveVfs(defaultRoot, { silent: true });
    setDirectoryHandle(null);
  }, [saveVfs]);


  return { 
    vfsRoot, 
    loading,
    fs,
    currentBranch,
    gitStatus,
    isGitStatusLoading,
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
    openPathWithApi,
    downloadVfsAsZip,
    cloneRepository,
    commit,
    findFileByPath,
    findNodeByPath,
    compileJavaProject,
    createNoCodeHProject,
    createBlankProject,
    exitProject,
  };
}
