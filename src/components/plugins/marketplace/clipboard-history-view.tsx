// src/components/plugins/marketplace/clipboard-history-view.tsx
"use client";

import React from 'react';
import { useAppState } from '@/hooks/use-app-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Clipboard, ClipboardCheck, ClipboardList, PenSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useVfs } from '@/hooks/use-vfs'; // Assuming this hook is available for editor access if needed

export function ClipboardHistoryView() {
    const { clipboardHistory } = useAppState();
    const { toast } = useToast();

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard!" });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Clipboard History
                </CardTitle>
                <CardDescription>Your last 20 copied items.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-48 w-full rounded-md border">
                    <div className="p-2 text-sm">
                        {clipboardHistory.length > 0 ? (
                            <ul className="space-y-1">
                                {clipboardHistory.map((item, index) => (
                                    <li 
                                        key={index}
                                        className="flex items-center justify-between p-2 rounded-md hover:bg-accent group"
                                    >
                                        <pre className="truncate font-mono text-xs flex-grow mr-2">
                                            {item}
                                        </pre>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                            onClick={() => handleCopy(item)}
                                        >
                                            <ClipboardCheck className="h-4 w-4" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                             <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                                <p>History is empty. Copy some text!</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
