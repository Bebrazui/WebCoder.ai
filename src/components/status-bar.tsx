"use client";

import { getLanguage, type VFSFile } from "@/lib/vfs";
import { Code, GitBranch, Terminal } from "lucide-react";

interface StatusBarProps {
  activeFile: VFSFile | null;
}

export function StatusBar({ activeFile }: StatusBarProps) {
  const language = activeFile ? getLanguage(activeFile.path) : "plaintext";
  return (
    <footer className="shrink-0 flex items-center justify-between px-4 py-1.5 border-t text-xs text-muted-foreground bg-background">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5" />
            <span>main</span>
        </div>
        {activeFile && (
            <div className="flex items-center gap-2">
                <Code className="h-3.5 w-3.5" />
                <span>{language}</span>
            </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Terminal className="h-3.5 w-3.5" />
        <span>Terminal</span>
      </div>
    </footer>
  );
}
