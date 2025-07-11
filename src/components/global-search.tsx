"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { VFSFile, VFSDirectory, VFSNode } from "@/lib/vfs";
import { FileText, Search } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { useDebounce } from "@/hooks/use-debounce";

interface GlobalSearchProps {
    vfsRoot: VFSDirectory;
    onFileSelect: (file: VFSFile) => void;
}

interface SearchResult {
    file: VFSFile;
    matchCount: number;
}

const searchInVfs = (root: VFSDirectory, query: string): SearchResult[] => {
    const results: SearchResult[] = [];
    const lowerCaseQuery = query.toLowerCase();

    const traverse = (node: VFSNode) => {
        if (node.type === 'file') {
            if (typeof node.content === 'string' && !node.content.startsWith('data:')) {
                const matchCount = (node.content.toLowerCase().match(new RegExp(lowerCaseQuery, 'g')) || []).length;
                if (matchCount > 0) {
                    results.push({ file: node, matchCount });
                }
            }
        } else if (node.type === 'directory') {
            node.children.forEach(traverse);
        }
    };

    traverse(root);
    return results;
};

export function GlobalSearch({ vfsRoot, onFileSelect }: GlobalSearchProps) {
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebounce(query, 300);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    
    useEffect(() => {
        if (debouncedQuery.trim() === "") {
            setSearchResults([]);
            return;
        }
        const results = searchInVfs(vfsRoot, debouncedQuery);
        setSearchResults(results);
    }, [debouncedQuery, vfsRoot]);

    return (
        <div className="flex flex-col h-full">
            <div className="p-2 border-b">
                <h2 className="text-lg font-headline font-semibold mb-2">Search</h2>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search in files..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>
            <ScrollArea className="flex-grow">
                 <div className="p-2 text-sm">
                    {query.trim() !== '' && searchResults.length === 0 && (
                        <p className="text-muted-foreground text-center p-4">No results found.</p>
                    )}
                     {searchResults.length > 0 && (
                         <Accordion type="multiple" className="w-full">
                            {searchResults.map(({ file, matchCount }) => (
                                <AccordionItem value={file.path} key={file.path}>
                                    <AccordionTrigger 
                                        className="text-sm hover:no-underline hover:bg-sidebar-accent px-2 py-1.5 rounded-md"
                                        onClick={() => onFileSelect(file)}
                                    >
                                        <div className="flex items-center gap-2 w-full">
                                            <FileText className="h-4 w-4 shrink-0" />
                                            <div className="flex justify-between items-center w-full">
                                                <span className="truncate font-medium">{file.name}</span>
                                                <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{matchCount}</span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    {/* We can add context lines here in the future */}
                                    {/* <AccordionContent>
                                        ... context lines ...
                                    </AccordionContent> */}
                                </AccordionItem>
                            ))}
                        </Accordion>
                     )}
                 </div>
            </ScrollArea>
        </div>
    );
}
