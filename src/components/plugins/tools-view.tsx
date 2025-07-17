// src/components/plugins/tools-view.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '../ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Clipboard, Hash, Fingerprint, Lock, Shield, Database, Trash2, RefreshCw } from 'lucide-react';
import CryptoJS from 'crypto-js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

// Hashing Component
function HashGenerator() {
    const [inputText, setInputText] = useState('');
    const { toast } = useToast();

    const hashes = {
        MD5: CryptoJS.MD5(inputText).toString(),
        SHA1: CryptoJS.SHA1(inputText).toString(),
        SHA256: CryptoJS.SHA256(inputText).toString(),
        SHA512: CryptoJS.SHA512(inputText).toString(),
    };

    const handleCopy = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: `${type} hash copied to clipboard.` });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Hash className="h-5 w-5" />
                    Hash Generator
                </CardTitle>
                <CardDescription>Generate various hashes from your text.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Textarea
                    placeholder="Enter text here..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    rows={4}
                />
                <div className="space-y-2">
                    {[
                        { name: 'MD5', value: hashes.MD5, icon: <Fingerprint className="text-blue-500" /> },
                        { name: 'SHA-1', value: hashes.SHA1, icon: <Lock className="text-orange-500" /> },
                        { name: 'SHA-256', value: hashes.SHA256, icon: <Shield className="text-green-500" /> },
                        { name: 'SHA-512', value: hashes.SHA512, icon: <Shield className="text-red-500" /> }
                    ].map(({ name, value, icon }) => (
                        <div key={name}>
                            <Label className="flex items-center gap-2 mb-1">{icon} {name}</Label>
                            <div className="flex gap-2">
                                <Input value={value} readOnly className="font-mono text-xs" />
                                <Button variant="ghost" size="icon" onClick={() => handleCopy(value, name)}>
                                    <Clipboard />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

// Local Storage Explorer
function LocalStorageExplorer() {
    const [storageItems, setStorageItems] = useState<[string, string | null][]>([]);
    const { toast } = useToast();

    const refreshStorage = () => {
        const items: [string, string | null][] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                items.push([key, localStorage.getItem(key)]);
            }
        }
        setStorageItems(items);
    };

    useEffect(() => {
        refreshStorage();
    }, []);

    const handleDelete = (key: string) => {
        if (confirm(`Are you sure you want to delete the key "${key}" from Local Storage?`)) {
            localStorage.removeItem(key);
            refreshStorage();
            toast({ title: 'Deleted', description: `Key "${key}" removed from Local Storage.` });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Local Storage Explorer
                     </div>
                     <Button variant="ghost" size="icon" onClick={refreshStorage} className="h-7 w-7">
                        <RefreshCw className="h-4 w-4" />
                     </Button>
                </CardTitle>
                <CardDescription>View and manage data in your browser's Local Storage.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-64 w-full rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Key</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead className="w-[50px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {storageItems.length > 0 ? (
                                storageItems.map(([key, value]) => (
                                    <TableRow key={key}>
                                        <TableCell className="font-mono text-xs font-semibold">{key}</TableCell>
                                        <TableCell className="font-mono text-xs truncate max-w-xs">{value}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(key)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                                        Local Storage is empty.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

export function ToolsView() {
    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
                <LocalStorageExplorer />
                <HashGenerator />
                 <Card className="border-dashed">
                    <CardHeader>
                        <CardTitle className="text-muted-foreground">More tools coming soon!</CardTitle>
                        <CardDescription>This section will be filled with more useful utilities.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        </ScrollArea>
    )
}
