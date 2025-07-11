"use client";

import React, { useState, useRef } from "react";
import { type VFSNode, type VFSDirectory, type VFSFile } from "@/lib/vfs";
import {
  ChevronRight,
  Folder,
  File as FileIcon,
  FolderOpen,
  Upload,
  FileArchive,
  FilePlus,
  FolderPlus,
  Edit,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

interface FileExplorerProps {
  vfsRoot: VFSDirectory;
  loading: boolean;
  onSelectFile: (file: VFSFile) => void;
  onUploadFile: (file: File, parent: VFSDirectory) => void;
  onUploadZip: (file: File) => void;
  onNewFile: (name: string, parent: VFSDirectory) => void;
  onNewFolder: (name: string, parent: VFSDirectory) => void;
  onRenameNode: (node: VFSNode, newName: string) => void;
  onDeleteNode: (node: VFSNode) => void;
}

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
}: FileExplorerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0], vfsRoot); // Upload to root by default
    }
  };
  
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadZip(e.target.files[0]);
    }
  };

  const handleNewFile = () => {
    const name = prompt("Enter new file name:");
    if (name) {
      onNewFile(name, vfsRoot);
    }
  };

  const handleNewFolder = () => {
    const name = prompt("Enter new folder name:");
    if (name) {
      onNewFolder(name, vfsRoot);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-sidebar-border">
          <h2 className="text-lg font-headline font-semibold">Explorer</h2>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="secondary" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> File
            </Button>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => zipInputRef.current?.click()}>
              <FileArchive className="mr-2 h-4 w-4" /> ZIP
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <input type="file" ref={zipInputRef} onChange={handleZipChange} className="hidden" accept=".zip" />
          </div>
      </div>
      <ScrollArea className="flex-grow">
        <div className="p-2 text-sm">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6 ml-4" />
              <Skeleton className="h-6 w-4/6" />
              <Skeleton className="h-6 w-5/6 ml-4" />
              <Skeleton className="h-6 w-3/6 ml-4" />
            </div>
          ) : (
            <ContextMenu>
              <ContextMenuTrigger>
                <ExplorerNode 
                  node={vfsRoot} 
                  onSelectFile={onSelectFile} 
                  level={0}
                  onNewFile={onNewFile}
                  onNewFolder={onNewFolder}
                  onRenameNode={onRenameNode}
                  onDeleteNode={onDeleteNode}
                />
              </ContextMenuTrigger>
              <ContextMenuContent>
                  <ContextMenuItem onClick={handleNewFile}>
                    <FilePlus className="mr-2 h-4 w-4" /> New File
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleNewFolder}>
                    <FolderPlus className="mr-2 h-4 w-4" /> New Folder
                  </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

const ExplorerNode = ({
  node,
  onSelectFile,
  level,
  onNewFile,
  onNewFolder,
  onRenameNode,
  onDeleteNode,
}: {
  node: VFSNode;
  onSelectFile: (file: VFSFile) => void;
  level: number;
  onNewFile: (name: string, parent: VFSDirectory) => void;
  onNewFolder: (name: string, parent: VFSDirectory) => void;
  onRenameNode: (node: VFSNode, newName: string) => void;
  onDeleteNode: (node: VFSNode) => void;
}) => {
  const [isOpen, setIsOpen] = useState(level === 0);

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
          <div>
            <div
              className="flex items-center p-1 rounded-md cursor-pointer hover:bg-sidebar-accent"
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
                <FolderOpen className="h-4 w-4 mr-2 text-accent" />
              ) : (
                <Folder className="h-4 w-4 mr-2 text-accent" />
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
                                onSelectFile={onSelectFile}
                                level={level + 1}
                                onNewFile={onNewFile}
                                onNewFolder={onNewFolder}
                                onRenameNode={onRenameNode}
                                onDeleteNode={onDeleteNode}
                            />
                    ))
                ) : (
                    <p className="p-1 text-muted-foreground" style={{ paddingLeft: `${(level + 1) * 1}rem` }}>
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

  // File Node
  return (
    <ContextMenu>
        <ContextMenuTrigger>
            <div
                className="flex items-center p-1 rounded-md cursor-pointer hover:bg-sidebar-accent"
                style={{ paddingLeft }}
                onClick={() => onSelectFile(node)}
            >
                <FileIcon className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{node.name}</span>
            </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
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
