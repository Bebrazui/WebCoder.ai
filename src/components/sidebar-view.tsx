
"use client";

import { useState } from "react";
import { FileExplorer } from "./file-explorer";
import { SourceControlView } from "./source-control-view";
import { Button } from "./ui/button";
import { FileCode, GitBranch } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";
import type { FileExplorerProps } from "./file-explorer";
import type { GitStatus } from "@/hooks/use-vfs";


export interface SidebarViewProps extends Omit<FileExplorerProps, 'className'> {
    gitStatus: GitStatus[];
    isGitStatusLoading: boolean;
    onCommit: (message: string, token: string) => Promise<void>;
}


export function SidebarView(props: SidebarViewProps) {
  const [activeView, setActiveView] = useState<View>("explorer");

  type View = "explorer" | "source-control";

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
    }
  ];

  const ActiveComponent = views.find(v => v.id === activeView)?.component;

  return (
    <div className="flex h-full">
      <div className="w-12 border-r border-sidebar-border bg-sidebar p-2 flex flex-col items-center gap-2">
        <TooltipProvider>
            {views.map(view => (
                <Tooltip key={view.id}>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8",
                                activeView === view.id && "bg-sidebar-accent text-sidebar-accent-foreground"
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

// Re-export props for parent component
export type { FileExplorerProps };

    