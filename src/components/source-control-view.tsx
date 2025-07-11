
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCommit, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

// Placeholder for changed files
const changedFiles = [
    { name: "src/components/ide.tsx", status: "M" },
    { name: "package.json", status: "M" },
    { name: "src/app/page.tsx", status: "A" },
    { name: "README.md", status: "D" },
];

const getStatusColor = (status: string) => {
    switch(status) {
        case "M": return "text-yellow-500"; // Modified
        case "A": return "text-green-500";  // Added
        case "D": return "text-red-500";    // Deleted
        default: return "text-muted-foreground";
    }
}

export function SourceControlView() {
    const [commitMessage, setCommitMessage] = useState("");

    return (
        <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
            <div className="p-2 border-b border-sidebar-border">
                <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    <span>Source Control</span>
                </h2>
            </div>
            <div className="p-2 space-y-2">
                <Textarea 
                    placeholder="Message"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="bg-background text-sm"
                />
                <Button className="w-full" disabled>
                    <GitCommit className="mr-2 h-4 w-4" />
                    Commit
                </Button>
            </div>
            <ScrollArea className="flex-grow">
                <div className="p-2 text-sm">
                    <h3 className="font-semibold mb-2 px-2">Changes ({changedFiles.length})</h3>
                    <ul className="space-y-1">
                        {changedFiles.map(file => (
                            <li key={file.name} className="flex items-center justify-between p-1 rounded-md hover:bg-sidebar-accent">
                                <span className="truncate">{file.name}</span>
                                <span className={cn("font-mono font-bold w-4 text-center", getStatusColor(file.status))}>
                                    {file.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </ScrollArea>
        </div>
    );
}
