// src/components/plugins/marketplace/todo-lister-view.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useVfs } from '@/hooks/use-vfs';
import { VFSNode, isTextFile } from '@/lib/vfs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoaderCircle, ListChecks, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

interface TodoItem {
    file: string;
    line: number;
    type: 'TODO' | 'FIXME';
    text: string;
}

export function TodoListerView() {
    const { vfsRoot, findFileByPath, saveFileToVfs, updateFileInVfs } = useVfs(); // Assuming useVfs provides file access
    const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const debouncedVfsRoot = useDebounce(vfsRoot, 1000); // Debounce to avoid re-scanning on every keystroke

    const scanFiles = useCallback(() => {
        setIsLoading(true);
        const results: TodoItem[] = [];
        const regex = /\/\/\s*(TODO|FIXME):(.*)/g;

        const traverse = (node: VFSNode) => {
            if (node.type === 'file' && isTextFile(node)) {
                const lines = node.content.split('\n');
                lines.forEach((line, index) => {
                    let match;
                    while ((match = regex.exec(line)) !== null) {
                        results.push({
                            file: node.path,
                            line: index + 1,
                            type: match[1].toUpperCase() as 'TODO' | 'FIXME',
                            text: match[2].trim(),
                        });
                    }
                });
            } else if (node.type === 'directory') {
                node.children.forEach(traverse);
            }
        };

        traverse(vfsRoot);
        setTodoItems(results);
        setIsLoading(false);
    }, [vfsRoot]);

    useEffect(() => {
        scanFiles();
    }, [debouncedVfsRoot, scanFiles]);

    const handleItemClick = (item: TodoItem) => {
        const file = findFileByPath(item.file);
        if (file) {
            // This is a placeholder. A real implementation would need a callback
            // to the IDE component to open the file and go to the line.
            console.log(`Request to open ${file.name} at line ${item.line}`);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <ListChecks className="h-5 w-5" />
                        TODO/FIXME Lister
                     </div>
                     <Button variant="ghost" size="icon" onClick={scanFiles} disabled={isLoading} className="h-7 w-7">
                        {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                     </Button>
                </CardTitle>
                <CardDescription>A list of tracked comments in your project.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-48 w-full rounded-md border">
                    <div className="p-2 text-sm">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                                <LoaderCircle className="h-5 w-5 animate-spin" />
                            </div>
                        ) : todoItems.length > 0 ? (
                            <ul className="space-y-1">
                                {todoItems.map((item, index) => (
                                    <li 
                                        key={index} 
                                        className="p-2 rounded-md hover:bg-accent cursor-pointer"
                                        onClick={() => handleItemClick(item)}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-xs truncate">{item.file}:{item.line}</span>
                                            <Badge variant={item.type === 'TODO' ? 'default' : 'destructive'} className={cn(item.type === 'TODO' && 'bg-blue-600 hover:bg-blue-700')}>
                                                {item.type}
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground text-xs">{item.text}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                                <p>No TODOs or FIXMEs found.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
