
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

const utilityPlugins = [
  {
    icon: <Braces className="h-8 w-8 text-amber-400" />,
    name: "JSON Formatter",
    description: "Format and validate JSON documents with ease.",
  },
  {
    icon: <Binary className="h-8 w-8 text-blue-400" />,
    name: "Base64 Tool",
    description: "Encode and decode text to and from Base64.",
  },
  {
    icon: <Link className="h-8 w-8 text-green-400" />,
    name: "URL Encoder/Decoder",
    description: "Encode and decode URL components.",
  },
  {
    icon: <Pilcrow className="h-8 w-8 text-purple-400" />,
    name: "Character Counter",
    description: "Count characters, words, sentences, and lines.",
  },
  {
    icon: <BookOpen className="h-8 w-8 text-rose-400" />,
    name: "Markdown Previewer",
    description: "Write and preview Markdown in real-time.",
  },
   {
    icon: <Database className="h-8 w-8 text-cyan-400" />,
    name: "AI SQL Generator",
    description: "Generate SQL queries from natural language.",
  },
];

const corePlugins = [
  {
    icon: <Type className="h-8 w-8 text-blue-500" />,
    name: "TypeScript/JavaScript Language Service",
    description: "Provides smart autocompletion, type-checking, and refactoring.",
  },
  {
    icon: <Bug className="h-8 w-8 text-red-500" />,
    name: "Node.js Debugger",
    description: "Set breakpoints, step through code, and inspect variables.",
  },
  {
    icon: <AppWindow className="h-8 w-8 text-indigo-500" />,
    name: "Linter & Formatter (ESLint/Prettier)",
    description: "Automatically format code and find potential errors.",
  },
];

const otherPlugins = [
   {
    icon: <Terminal className="h-8 w-8 text-lime-500" />,
    name: "NPM/Yarn Integration",
    description: "Run scripts and manage dependencies from the UI.",
  },
  {
    icon: <GitGraph className="h-8 w-8 text-orange-500" />,
    name: "Git Graph",
    description: "Visualize your Git history with an interactive graph.",
  },
  {
    icon: <Box className="h-8 w-8 text-teal-500" />,
    name: "Code Snippets",
    description: "Create and use templates for frequently used code blocks.",
  },
  {
    icon: <Palette className="h-8 w-8 text-pink-500" />,
    name: "Theme & Icon Pack",
    description: "Customize the look and feel of your IDE.",
  },
];

export function PluginMarketplace() {
  const { toast } = useToast();

  const handleInstall = (pluginName: string) => {
    toast({
      title: "Installation Not Implemented",
      description: `Installing "${pluginName}" is not yet supported.`,
    });
  };

  const PluginCard = ({
    plugin,
  }: {
    plugin: { icon: React.ReactNode; name: string; description: string };
  }) => (
    <div className="flex items-start gap-4 rounded-lg border p-4">
      <div className="mt-1">{plugin.icon}</div>
      <div className="flex-1">
        <h3 className="font-semibold">{plugin.name}</h3>
        <p className="text-sm text-muted-foreground">{plugin.description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleInstall(plugin.name)}
      >
        Install
      </Button>
    </div>
  );

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
             <h3 className="text-base font-semibold mb-4">Core Functionality</h3>
             <div className="space-y-4">
                {corePlugins.map(p => <PluginCard key={p.name} plugin={p} />)}
             </div>
          </div>
          <div>
             <h3 className="text-base font-semibold mb-4">Developer Utilities</h3>
             <div className="space-y-4">
                {utilityPlugins.map(p => <PluginCard key={p.name} plugin={p} />)}
             </div>
          </div>
           <div>
             <h3 className="text-base font-semibold mb-4">Workflow & Customization</h3>
             <div className="space-y-4">
                {otherPlugins.map(p => <PluginCard key={p.name} plugin={p} />)}
             </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
