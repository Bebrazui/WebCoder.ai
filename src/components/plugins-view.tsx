
"use client";

import { Puzzle, CheckCircle, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Separator } from "./ui/separator";

const installedPlugins = [
    { name: "Git Integration", description: "Source control, history, and branching.", version: "1.2.0" },
    { name: "No-Code Game Tools", description: "Visual editors for game development.", version: "0.8.1" },
    { name: "Java Language Support", description: "Compiler and runtime integration for Java.", version: "1.0.5" },
    { name: "Multi-Language Runner", description: "Execution environments for Python, Go, Rust, etc.", version: "1.1.0" },
];

export function PluginsView() {
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            <span>Plugins</span>
        </h2>
      </div>
      <div className="flex-grow p-4 space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Installed</CardTitle>
                <CardDescription>Plugins currently active in your environment.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-4">
                    {installedPlugins.map(plugin => (
                        <li key={plugin.name} className="flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold">{plugin.name}</h4>
                                <p className="text-sm text-muted-foreground">{plugin.description}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-500">
                                <CheckCircle className="h-4 w-4" />
                                <span>v{plugin.version}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
        
        <Separator />

        <div className="text-center text-muted-foreground p-4">
            <Store className="h-10 w-10 mx-auto mb-2"/>
            <p className="font-semibold">Plugin Marketplace</p>
            <p className="text-sm">Discover and install new plugins. Coming soon!</p>
        </div>
      </div>
    </div>
  );
}
