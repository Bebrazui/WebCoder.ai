
"use client";

import { getLanguage, type VFSFile } from "@/lib/vfs";
import { Code, GitBranch, Terminal, Save, ChevronUp, ChevronDown, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface StatusBarProps {
  activeFile: VFSFile | null;
  isDirty: boolean;
  onTerminalToggle: () => void;
  isTerminalOpen: boolean;
  onCommandPaletteToggle: () => void;
}

export function StatusBar({ activeFile, isDirty, onTerminalToggle, isTerminalOpen, onCommandPaletteToggle }: StatusBarProps) {
  const language = activeFile ? getLanguage(activeFile.path) : "plaintext";
  return (
    <footer className="shrink-0 flex items-center justify-between px-4 py-1.5 border-t text-xs text-muted-foreground bg-background">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5" />
            <span>main</span>
        </div>
        {activeFile && (
            <>
                <div className="flex items-center gap-2">
                    <Code className="h-3.5 w-3.5" />
                    <span>{language}</span>
                </div>
                <div
                    className={cn(
                        "flex items-center gap-2 transition-colors",
                        isDirty ? "text-blue-500" : "text-muted-foreground"
                    )}
                    title={isDirty ? "Unsaved changes" : "Saved"}
                >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isDirty ? 'Unsaved' : 'Saved'}</span>
                </div>
            </>
        )}
      </div>
      <div className="flex items-center gap-2">
         <Button variant="ghost" size="sm" onClick={onCommandPaletteToggle} className="text-xs h-auto p-1 text-muted-foreground">
            <Command className="h-3.5 w-3.5 mr-1" />
            <span>Cmd Palette</span>
            <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
            </kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={onTerminalToggle} className="text-xs h-auto p-1 text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" />
            <span>Terminal</span>
            {isTerminalOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </footer>
  );
}
