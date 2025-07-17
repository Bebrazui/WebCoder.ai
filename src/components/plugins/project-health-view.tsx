// src/components/plugins/project-health-view.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVfs } from '@/hooks/use-vfs';
import { ScrollArea } from '../ui/scroll-area';
import { GitCommit, Package, HeartPulse, LoaderCircle, RefreshCw } from 'lucide-react';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface Dependency {
    name: string;
    version: string;
}

interface Commit {
    oid: string;
    message: string;
    author: string;
    date: Date;
}

export function ProjectHealthView() {
    const { vfsRoot, findFileByPath, fs } = useVfs();
    const [dependencies, setDependencies] = useState<Dependency[]>([]);
    const [devDependencies, setDevDependencies] = useState<Dependency[]>([]);
    const [commits, setCommits] = useState<Commit[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const parseDependencies = useCallback(() => {
        const packageJsonFile = findFileByPath('package.json');
        if (packageJsonFile) {
            try {
                const packageJson = JSON.parse(packageJsonFile.content);
                const deps = packageJson.dependencies ? Object.entries(packageJson.dependencies).map(([name, version]) => ({ name, version: version as string })) : [];
                const devDeps = packageJson.devDependencies ? Object.entries(packageJson.devDependencies).map(([name, version]) => ({ name, version: version as string })) : [];
                setDependencies(deps);
                setDevDependencies(devDeps);
            } catch (e) {
                console.error("Failed to parse package.json", e);
            }
        }
    }, [findFileByPath]);

    const fetchCommits = useCallback(async () => {
        try {
            const gitCommits = await git.log({ fs: fs as any, dir: '/', depth: 10 });
            const formattedCommits: Commit[] = gitCommits.map(c => ({
                oid: c.oid,
                message: c.commit.message.split('\n')[0], // Only first line
                author: c.commit.author.name,
                date: new Date(c.commit.author.timestamp * 1000)
            }));
            setCommits(formattedCommits);
        } catch (e) {
            setCommits([]); // Not a git repo or error
        }
    }, [fs]);
    
    const refreshData = useCallback(async () => {
        setIsLoading(true);
        parseDependencies();
        await fetchCommits();
        setIsLoading(false);
    }, [parseDependencies, fetchCommits]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const renderDepList = (deps: Dependency[], title: string) => (
        <div className="space-y-2">
            <h4 className="font-semibold text-sm">{title} <Badge variant="secondary">{deps.length}</Badge></h4>
            <div className="p-2 border rounded-md max-h-48 overflow-y-auto">
                <ul className="space-y-1">
                {deps.map(dep => (
                    <li key={dep.name} className="flex justify-between items-center text-xs">
                        <span className="font-mono">{dep.name}</span>
                        <span className="font-mono text-muted-foreground">{dep.version}</span>
                    </li>
                ))}
                </ul>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            <div className="p-2 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
                    <HeartPulse className="h-5 w-5" />
                    <span>Project Health</span>
                </h2>
                <Button variant="ghost" size="icon" onClick={refreshData} disabled={isLoading} className="h-7 w-7">
                    {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
            </div>
            <ScrollArea className="flex-grow">
                <div className="p-4 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5"/> Dependencies</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {renderDepList(dependencies, "Dependencies")}
                            {renderDepList(devDependencies, "Dev Dependencies")}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><GitCommit className="h-5 w-5"/> Recent Commits</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="p-2 border rounded-md max-h-64 overflow-y-auto">
                                <ul className="space-y-3">
                                    {commits.length > 0 ? commits.map(commit => (
                                        <li key={commit.oid}>
                                            <p className="font-semibold text-xs truncate">{commit.message}</p>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <span>{commit.author}</span>
                                                <span>{commit.date.toLocaleDateString()}</span>
                                            </div>
                                        </li>
                                    )) : <p className="text-xs text-muted-foreground text-center p-4">No commits found.</p>}
                                </ul>
                             </div>
                        </CardContent>
                    </Card>
                </div>
            </ScrollArea>
        </div>
    );
}
