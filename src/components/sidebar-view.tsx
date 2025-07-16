// src/components/sidebar-view.tsx
"use client";

import { useState } from "react";
import { FileExplorer } from "./file-explorer";
import { SourceControlView } from "./source-control-view";
import { Button } from "./ui/button";
import { FileCode, GitBranch, ListTree, PlayCircle, Puzzle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";
import type { FileExplorerProps } from "./file-explorer";
import type { GitStatus } from "@/hooks/use-vfs";
import { OutlineView, OutlineData } from "./outline-view";
import { RunView } from "./run-view";
import { PluginsView } from "./plugins-view";

export interface SidebarProps extends Omit<FileExplorerProps, 'className' | 'onGenerateReadme' | 'isGeneratingReadme'> {
    gitStatus: GitStatus[];
    isGitStatusLoading: boolean;
    onCommit: (message: string, token: string) => Promise<void>;
    outlineData: OutlineData[];
    onSymbolSelect: (range: any) => void;
    onCompileJava: () => Promise<boolean>;
}

type View = "explorer" | "source-control" | "outline" | "run" | "plugins";

export function Sidebar(props: SidebarProps) {
  const [activeView, setActiveView] = useState<View>("explorer");

  const views: { id: View, icon: React.ReactNode, label: string, component: React.ReactNode }[] = [
    {
      id: "explorer",
      icon: <FileCode />,
      label: "Explorer",
      component: <FileExplorer {...props} />
    },
    {
      id: "source-control",
      icon: <GitBranch />,
      label: "Source Control",
      component: <SourceControlView changedFiles={props.gitStatus} isLoading={props.isGitStatusLoading} onCommit={props.onCommit} />
    },
    {
      id: "outline",
      icon: <ListTree />,
      label: "Outline",
      component: <OutlineView symbols={props.outlineData} onSymbolSelect={props.onSymbolSelect} />
    },
    {
      id: "run",
      icon: <PlayCircle />,
      label: "Run and Debug",
      component: <RunView />
    },
    {
      id: "plugins",
      icon: <Puzzle />,
      label: "Plugins",
      component: <PluginsView />
    }
  ];

  const ActiveComponent = views.find(v => v.id === activeView)?.component;

  return (
    <div className="flex h-full bg-background">
      <div className="w-12 border-r border-border bg-background p-2 flex flex-col items-center gap-2">
        <TooltipProvider>
            {views.map(view => (
                <Tooltip key={view.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8",
                                activeView.includes(view.id) && "bg-accent text-accent-foreground"
                            )}
                            onClick={() => setActiveView(view.id)}
                        >
                            {view.icon}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>{view.label}</p>
                    </TooltipContent>
                </Tooltip>
            ))}
        </TooltipProvider>
      </div>
      <div className="flex-1 min-w-0">
        {ActiveComponent}
      </div>
    </div>
  );
}
