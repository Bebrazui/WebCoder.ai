
"use client";

import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CharacterCounter() {
  const [text, setText] = useState("");

  const stats = useMemo(() => {
    const characters = text.length;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const lines = text.split('\n').length;
    const sentences = text.split(/[.!?]+/).filter(Boolean).length;
    return { characters, words, lines, sentences };
  }, [text]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold">Character Counter</h2>
      </div>

      <div className="flex-grow grid grid-rows-2 p-4 gap-4">
        <div className="space-y-2 flex flex-col">
            <Label htmlFor="text-input">Your Text</Label>
            <Textarea
                id="text-input"
                placeholder="Paste your text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="font-mono text-sm flex-grow"
            />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Characters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.characters}</div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Words</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.words}</div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Lines</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.lines}</div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sentences</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.sentences}</div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
