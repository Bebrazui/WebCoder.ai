// src/components/command-palette.tsx
"use client";

import { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { Terminal, WandSparkles, FileJson, Pilcrow } from 'lucide-react';
import type { VFSFile } from '@/lib/vfs';
import { useAppState } from '@/hooks/use-app-state';
import type * as monaco from "monaco-editor";
import { useToast } from '@/hooks/use-toast';
import * as prettier from "prettier/standalone";
import * as prettierPluginBabel from "prettier/plugins/babel";
import * as prettierPluginEstree from "prettier/plugins/estree";

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
  const { toast } = useToast();
  const [isFormatting, setIsFormatting] = useState(false);

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

  const insertAtCursor = (text: string) => {
    const selection = editor?.getSelection();
    if (editor && selection) {
        editor.executeEdits("inserter", [{
            range: selection,
            text: text,
            forceMoveMarkers: true,
        }]);
    }
  };

  const handleInsertLoremIpsum = () => {
    runCommand(() => {
        const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
        insertAtCursor(lorem);
    });
  }
  
  const handleFormatJson = async () => {
    if (isFormatting || !editor) return;

    const model = editor.getModel();
    if (!model || model.getLanguageId() !== 'json') {
        toast({ variant: "destructive", title: "Not a JSON file", description: "This command can only be run on a JSON file." });
        setIsOpen(false);
        return;
    }
    
    setIsFormatting(true);
    setIsOpen(false);

    try {
        const currentCode = editor.getValue();
        // First, check if JSON is valid by parsing
        JSON.parse(currentCode);

        const formattedCode = await prettier.format(currentCode, {
            parser: "json",
            plugins: [prettierPluginBabel, prettierPluginEstree],
        });
        
        editor.setValue(formattedCode);
        toast({ title: "JSON Formatted", description: "The file has been successfully formatted." });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Invalid JSON", description: `Could not format the file. Error: ${error.message}` });
    } finally {
        setIsFormatting(false);
    }
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
        
        <CommandSeparator />
        
        <CommandGroup heading="Utilities">
            {editorSettings.randomStringGeneratorEnabled && (
                <CommandItem onSelect={handleGenerateUUID}>
                    <WandSparkles className="mr-2 h-4 w-4" />
                    <span>Generate UUID</span>
                </CommandItem>
            )}
             <CommandItem onSelect={handleInsertLoremIpsum}>
                <Pilcrow className="mr-2 h-4 w-4" />
                <span>Insert Lorem Ipsum</span>
            </CommandItem>
             <CommandItem onSelect={handleFormatJson} disabled={isFormatting}>
                <FileJson className="mr-2 h-4 w-4" />
                <span>Format JSON</span>
            </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
