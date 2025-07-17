
"use client";

import { useState } from "react";
import { Puzzle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolsView } from "@/components/plugins/tools-view";
import { ScrollArea } from "@/components/ui/scroll-area";


export function PluginsView() {
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            <span>Plugins & Tools</span>
        </h2>
      </div>
      <Tabs defaultValue="tools" className="flex-grow flex flex-col">
        <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="tools">Utilities</TabsTrigger>
                <TabsTrigger value="marketplace" disabled>Marketplace</TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="tools" className="flex-grow mt-0">
          <ScrollArea className="h-full">
            <ToolsView />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="marketplace" className="flex-grow mt-0">
          {/* Marketplace content will go here */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
