// src/components/plugins/tools-view.tsx
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '../ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Clipboard, Hash, Fingerprint, Lock, Shield } from 'lucide-react';
import CryptoJS from 'crypto-js';

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


export function ToolsView() {
    return (
        <div className="p-4 space-y-6">
            <HashGenerator />
             <Card className="border-dashed">
                <CardHeader>
                    <CardTitle className="text-muted-foreground">More tools coming soon!</CardTitle>
                    <CardDescription>This section will be filled with more useful utilities.</CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
}
