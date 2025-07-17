
"use client";

import { useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { Terminal, WandSparkles } from 'lucide-react';
import type { VFSFile } from '@/lib/vfs';
import { useAppState } from '@/hooks/use-app-state';
import type * as monaco from "monaco-editor";

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSelectFile: (file: VFSFile) => void;
  onToggleTerminal: () => void;
  editor: monaco.editor.IStandaloneCodeEditor | null;
}

export function CommandPalette({
  isOpen,
  setIsOpen,
  onToggleTerminal,
  editor
}: CommandPaletteProps) {
  const { editorSettings } = useAppState();

  const runCommand = (command: () => void) => {
    setIsOpen(false);
    command();
  };
  
  const handleTerminalToggle = () => {
    runCommand(onToggleTerminal);
  }

  const handleGenerateUUID = () => {
    runCommand(() => {
        const uuid = crypto.randomUUID();
        const selection = editor?.getSelection();
        if (editor && selection) {
            editor.executeEdits("uuid-generator", [{
                range: selection,
                text: uuid,
                forceMoveMarkers: true,
            }]);
        }
    });
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="General Commands">
          <CommandItem onSelect={handleTerminalToggle}>
            <Terminal className="mr-2 h-4 w-4" />
            <span>Toggle Terminal</span>
          </CommandItem>
        </CommandGroup>
        
        {editorSettings.randomStringGeneratorEnabled && (
            <>
            <CommandSeparator />
            <CommandGroup heading="Generators">
                <CommandItem onSelect={handleGenerateUUID}>
                    <WandSparkles className="mr-2 h-4 w-4" />
                    <span>Generate UUID</span>
                </CommandItem>
            </CommandGroup>
            </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
