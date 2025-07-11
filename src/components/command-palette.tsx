
"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { File as FileIcon, Terminal } from 'lucide-react';
import type { VFSFile, VFSDirectory, VFSNode } from '@/lib/vfs';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  vfsRoot: VFSDirectory;
  onSelectFile: (file: VFSFile) => void;
  onToggleTerminal: () => void;
}

const getAllFiles = (root: VFSDirectory): VFSFile[] => {
  const files: VFSFile[] = [];
  const traverse = (node: VFSNode) => {
    if (node.type === 'file') {
      files.push(node);
    } else if (node.type === 'directory') {
      node.children.forEach(traverse);
    }
  };
  traverse(root);
  return files;
};

export function CommandPalette({
  isOpen,
  setIsOpen,
  vfsRoot,
  onSelectFile,
  onToggleTerminal,
}: CommandPaletteProps) {

  const allFiles = useMemo(() => getAllFiles(vfsRoot), [vfsRoot]);

  const runCommand = (command: () => void) => {
    setIsOpen(false);
    command();
  };
  
  const handleFileSelect = (file: VFSFile) => {
    runCommand(() => onSelectFile(file));
  };
  
  const handleTerminalToggle = () => {
    runCommand(onToggleTerminal);
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Commands">
          <CommandItem onSelect={handleTerminalToggle}>
            <Terminal className="mr-2 h-4 w-4" />
            <span>Toggle Terminal</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Files">
          {allFiles.map((file) => (
            <CommandItem
              key={file.path}
              value={file.name}
              onSelect={() => handleFileSelect(file)}
            >
              <FileIcon className="mr-2 h-4 w-4" />
              <span className="mr-2">{file.name}</span>
              <span className="text-xs text-muted-foreground truncate">{file.path}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
