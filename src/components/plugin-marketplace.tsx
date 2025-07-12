
"use client";

import {
  AppWindow,
  Binary,
  BookOpen,
  Box,
  Braces,
  Bug,
  Database,
  GitGraph,
  Link,
  Palette,
  Pilcrow,
  Puzzle,
  Terminal,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

const availablePlugins = [
  {
    id: "sql-generator",
    icon: <Database className="h-8 w-8 text-cyan-400" />,
    name: "AI SQL Generator",
    description: "Generate SQL queries from natural language.",
  },
  {
    id: "json-formatter",
    icon: <Braces className="h-8 w-8 text-amber-400" />,
    name: "JSON Formatter",
    description: "Format and validate JSON documents with ease.",
  },
  {
    id: "base64-tool",
    icon: <Binary className="h-8 w-8 text-blue-400" />,
    name: "Base64 Tool",
    description: "Encode and decode text to and from Base64.",
  },
  {
    id: "url-tool",
    icon: <Link className="h-8 w-8 text-green-400" />,
    name: "URL Encoder/Decoder",
    description: "Encode and decode URL components.",
  },
  {
    id: "char-counter",
    icon: <Pilcrow className="h-8 w-8 text-purple-400" />,
    name: "Character Counter",
    description: "Count characters, words, sentences, and lines.",
  },
   {
    id: "markdown-previewer",
    icon: <BookOpen className="h-8 w-8 text-rose-400" />,
    name: "Markdown Previewer",
    description: "Write and preview Markdown in real-time.",
  },
];

interface PluginMarketplaceProps {
    onSelectPlugin: (id: string) => void;
}

export function PluginMarketplace({ onSelectPlugin }: PluginMarketplaceProps) {

  const PluginCard = ({
    plugin,
  }: {
    plugin: { id: string; icon: React.ReactNode; name: string; description: string };
  }) => {
    return (
        <div className="flex items-start gap-4 rounded-lg border p-4">
          <div className="mt-1">{plugin.icon}</div>
          <div className="flex-1">
            <h3 className="font-semibold">{plugin.name}</h3>
            <p className="text-sm text-muted-foreground">{plugin.description}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onSelectPlugin(plugin.id)}>
            Open
          </Button>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            <span>Plugin Marketplace</span>
        </h2>
      </div>
      <ScrollArea className="flex-grow">
        <div className="p-4 space-y-8">
          <div>
             <h3 className="text-base font-semibold mb-4">Developer Utilities</h3>
             <div className="space-y-4">
                {availablePlugins.map(p => <PluginCard key={p.id} plugin={p} />)}
             </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
