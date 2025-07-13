
"use client";

import { Puzzle } from "lucide-react";

export function PluginsView() {
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            <span>Plugins</span>
        </h2>
      </div>
      <div className="flex-grow p-4 flex flex-col items-center justify-center text-center">
        <Puzzle className="h-16 w-16 mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">Plugin Marketplace</h3>
        <p className="text-muted-foreground">
            Plugin management is coming soon.
        </p>
      </div>
    </div>
  );
}
