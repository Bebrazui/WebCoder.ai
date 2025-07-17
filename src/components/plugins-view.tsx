// src/components/plugins-view.tsx
"use client";

import { Puzzle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolsView } from "@/components/plugins/tools-view";
import { MarketplaceView } from "@/components/plugins/marketplace-view";
import { ScrollArea } from "@/components/ui/scroll-area";


export function PluginsView() {
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border flex-shrink-0">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            <span>Plugins & Tools</span>
        </h2>
      </div>
      <Tabs defaultValue="tools" className="flex-grow flex flex-col overflow-hidden">
        <div className="px-4 pt-2 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="tools">Utilities</TabsTrigger>
                <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="tools" className="flex-grow mt-2 flex flex-col overflow-y-hidden">
            <ScrollArea className="h-full scrollbar-hide">
                <ToolsView />
            </ScrollArea>
        </TabsContent>
        <TabsContent value="marketplace" className="flex-grow mt-2 flex flex-col overflow-y-hidden">
            <ScrollArea className="h-full scrollbar-hide">
                <MarketplaceView />
            </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
