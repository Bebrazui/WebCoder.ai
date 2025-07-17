// src/components/plugins-view.tsx
"use client";

import { Puzzle } from "lucide-react";
import { MarketplaceView } from "@/components/plugins/marketplace-view";
import { ScrollArea } from "@/components/ui/scroll-area";


export function PluginsView() {
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border flex-shrink-0">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            <span>Plugins & Marketplace</span>
        </h2>
      </div>
      <ScrollArea className="flex-grow scrollbar-hide">
        <MarketplaceView />
      </ScrollArea>
    </div>
  );
}
