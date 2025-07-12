
"use client";

import { useState } from "react";
import { FileExplorer } from "./file-explorer";
import { SourceControlView } from "./source-control-view";
import { Button } from "./ui/button";
import { FileCode, GitBranch, ListTree, Puzzle, Database } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";
import type { FileExplorerProps } from "./file-explorer";
import type { GitStatus } from "@/hooks/use-vfs";
import { OutlineView, OutlineData } from "./outline-view";
import { PluginMarketplace } from "./plugin-marketplace";
import { SqlGenerator } from "./sql-generator";
import { JsonFormatter } from "./plugins/json-formatter";
import { Base64EncoderDecoder } from "./plugins/base64-encoder-decoder";
import { UrlEncoderDecoder } from "./plugins/url-encoder-decoder";
import { CharacterCounter } from "./plugins/character-counter";
import { MarkdownPreviewer } from "./plugins/markdown-previewer";


export interface SidebarProps extends Omit<FileExplorerProps, 'className'> {
    gitStatus: GitStatus[];
    isGitStatusLoading: boolean;
    onCommit: (message: string, token: string) => Promise<void>;
    outlineData: OutlineData[];
    onSymbolSelect: (range: any) => void;
}

type View = "explorer" | "source-control" | "outline" | "plugins" | "sql-generator" | "json-formatter" | "base64-tool" | "url-tool" | "char-counter" | "markdown-previewer";

export function Sidebar(props: SidebarProps) {
  const [activeView, setActiveView] = useState<View>("explorer");

  const views: { id: View, icon: React.ReactNode, label: string, main: boolean, component: React.ReactNode }[] = [
    {
      id: "explorer",
      icon: <FileCode />,
      label: "Explorer",
      main: true,
      component: <FileExplorer {...props} />
    },
    {
      id: "source-control",
      icon: <GitBranch />,
      label: "Source Control",
      main: true,
      component: <SourceControlView changedFiles={props.gitStatus} isLoading={props.isGitStatusLoading} onCommit={props.onCommit} />
    },
    {
      id: "outline",
      icon: <ListTree />,
      label: "Outline",
      main: true,
      component: <OutlineView symbols={props.outlineData} onSymbolSelect={props.onSymbolSelect} />
    },
    {
      id: "plugins",
      icon: <Puzzle />,
      label: "Plugins",
      main: true,
      component: <PluginMarketplace onSelectPlugin={setActiveView} />
    },
     {
      id: "sql-generator",
      icon: <Database/>,
      label: "AI SQL Generator",
      main: false,
      component: <SqlGenerator/>
     },
     {
      id: "json-formatter",
      icon: null,
      label: "JSON Formatter",
      main: false,
      component: <JsonFormatter />
    },
    {
      id: "base64-tool",
      icon: null,
      label: "Base64 Tool",
      main: false,
      component: <Base64EncoderDecoder />
    },
    {
      id: "url-tool",
      icon: null,
      label: "URL Encoder/Decoder",
      main: false,
      component: <UrlEncoderDecoder />
    },
    {
      id: "char-counter",
      icon: null,
      label: "Character Counter",
      main: false,
      component: <CharacterCounter />
    },
    {
      id: "markdown-previewer",
      icon: null,
      label: "Markdown Previewer",
      main: false,
      component: <MarkdownPreviewer />
    }
  ];

  const mainViews = views.filter(v => v.main);
  const ActiveComponent = views.find(v => v.id === activeView)?.component;

  return (
    <div className="flex h-full bg-background">
      <div className="w-12 border-r border-border bg-background p-2 flex flex-col items-center gap-2">
        <TooltipProvider>
            {mainViews.map(view => (
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
