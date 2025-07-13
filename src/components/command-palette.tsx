
"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Terminal } from 'lucide-react';
import type { VFSFile } from '@/lib/vfs';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSelectFile: (file: VFSFile) => void;
  onToggleTerminal: () => void;
}

export function CommandPalette({
  isOpen,
  setIsOpen,
  onToggleTerminal,
}: CommandPaletteProps) {

  const runCommand = (command: () => void) => {
    setIsOpen(false);
    command();
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
      </CommandList>
    </CommandDialog>
  );
}
