
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { GitBranch, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitStatus } from "@/hooks/use-vfs";

interface SourceControlViewProps {
    changedFiles: GitStatus[];
    isLoading: boolean;
}

const getStatusColor = (status: string) => {
    switch(status) {
        case "modified": return "text-yellow-500";
        case "new": return "text-green-500";
        case "deleted": return "text-red-500";
        default: return "text-muted-foreground";
    }
}
const getStatusLetter = (status: string) => {
    switch(status) {
        case "modified": return "M";
        case "new": return "A"; // Added
        case "deleted": return "D";
        default: return "?";
    }
}

export function SourceControlView({ changedFiles, isLoading }: SourceControlViewProps) {
    return (
        <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
            <div className="p-2 border-b border-sidebar-border">
                <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    <span>Source Control</span>
                </h2>
            </div>
            
            <ScrollArea className="flex-grow">
                <div className="p-2 text-sm">
                    <h3 className="font-semibold mb-2 px-2 flex items-center gap-2">
                        Changes ({isLoading ? '...' : changedFiles.length})
                        {isLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    </h3>
                    {changedFiles.length > 0 ? (
                        <ul className="space-y-1">
                            {changedFiles.map(file => (
                                <li key={file.filepath} className="flex items-center justify-between p-1 rounded-md hover:bg-sidebar-accent">
                                    <span className="truncate">{file.filepath}</span>
                                    <span 
                                        className={cn("font-mono font-bold w-4 text-center", getStatusColor(file.status))}
                                        title={file.status}
                                    >
                                        {getStatusLetter(file.status)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !isLoading && <p className="text-muted-foreground text-center p-4">No changes detected.</p>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
