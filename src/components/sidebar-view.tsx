// src/components/sidebar-view.tsx
"use client";

import { useState } from "react";
import { FileExplorer, type FileExplorerProps, LaunchConfig } from "./file-explorer";
import { SourceControlView } from "./source-control-view";
import { Button } from "./ui/button";
import { FileCode, GitBranch, ListTree, PlayCircle, Puzzle, type LucideProps, Wrench, HeartPulse, Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";
import type { GitStatus } from "@/hooks/use-vfs";
import { OutlineView, OutlineData } from "./outline-view";
import { RunView } from "./run-view";
import { PluginsView } from "./plugins-view";
import type * as monaco from 'monaco-editor';
import { useVfs } from "@/hooks/use-vfs";
import { ToolsView } from "./plugins/tools-view";
import { ProjectHealthView } from "./plugins/project-health-view";
import { BrowserView } from "./plugins/browser-view";


export interface SidebarProps extends Omit<FileExplorerProps, 'className' | 'launchConfigs'> {
    gitStatus: GitStatus[];
    isGitStatusLoading: boolean;
    onCommit: (message: string, token: string) => Promise<void>;
    outlineData: OutlineData[];
    onSymbolSelect: (range: any) => void;
    onCompileJava: () => Promise<boolean>;
    launchConfigs: LaunchConfig[];
}

type View = "explorer" | "source-control" | "outline" | "run" | "plugins" | "utilities" | "health" | "browser";

export function Sidebar(props: SidebarProps) {
  const [activeView, setActiveView] = useState<View>("explorer");

  const views: { id: View, icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>, label: string, component: React.ReactNode }[] = [
    {
      id: "explorer",
      icon: FileCode,
      label: "Explorer",
      component: <FileExplorer {...props} />
    },
    {
      id: "source-control",
      icon: GitBranch,
      label: "Source Control",
      component: <SourceControlView changedFiles={props.gitStatus} isLoading={props.isGitStatusLoading} onCommit={props.onCommit} />
    },
     {
      id: "run",
      icon: PlayCircle,
      label: "Run and Debug",
      component: <RunView onSelectFile={props.onSelectFile} />
    },
    {
      id: "browser",
      icon: Globe,
      label: "Web Browser",
      component: <BrowserView />
    },
    {
      id: "outline",
      icon: ListTree,
      label: "Outline",
      component: <OutlineView symbols={props.outlineData} onSymbolSelect={props.onSymbolSelect} />
    },
    {
      id: "health",
      icon: HeartPulse,
      label: "Project Health",
      component: <ProjectHealthView />
    },
    {
      id: "plugins",
      icon: Puzzle,
      label: "Marketplace",
      component: <PluginsView />
    },
    {
      id: "utilities",
      icon: Wrench,
      label: "Utilities",
      component: <ToolsView />
    }
  ];

  const ActiveComponent = views.find(v => v.id === activeView)?.component;

  return (
    <div className="flex h-full bg-background">
      <div className="w-12 border-r border-border bg-background p-2 flex flex-col items-center gap-2">
        <TooltipProvider>
            {views.map(view => {
                const Icon = view.icon;
                return (
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
                                <Icon className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            <p>{view.label}</p>
                        </TooltipContent>
                    </Tooltip>
                )
            })}
        </TooltipProvider>
      </div>
      <div className="flex-1 min-w-0">
        {ActiveComponent}
      </div>
    </div>
  );
}
