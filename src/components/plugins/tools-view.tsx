// src/components/plugins/tools-view.tsx
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as CryptoJS from 'crypto-js';

// --- Sub-components for each tool ---

function Base64Converter() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const { toast } = useToast();

    const handleEncode = () => setOutput(btoa(input));
    const handleDecode = () => {
        try {
            setOutput(atob(input));
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Invalid Base64 string.' });
        }
    };
    const handleCopy = () => {
        navigator.clipboard.writeText(output);
        toast({ title: 'Copied!', description: 'Output copied to clipboard.' });
    };

    return (
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="base64-input">Input</Label>
                    <Textarea id="base64-input" value={input} onChange={(e) => setInput(e.target.value)} rows={5} placeholder="Type text here..." />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="base64-output">Output</Label>
                    <div className="relative">
                        <Textarea id="base64-output" value={output} readOnly rows={5} className="pr-10" />
                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={handleCopy} disabled={!output}><Copy className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleEncode}>Encode</Button>
                <Button onClick={handleDecode} variant="secondary">Decode</Button>
            </div>
        </CardContent>
    );
}

function HashGenerator() {
    const [input, setInput] = useState('');
    const [algorithm, setAlgorithm] = useState('sha256');
    const [output, setOutput] = useState('');
    const { toast } = useToast();

    const handleGenerate = () => {
        let hash;
        switch (algorithm) {
            case 'md5': hash = CryptoJS.MD5(input); break;
            case 'sha1': hash = CryptoJS.SHA1(input); break;
            case 'sha256': hash = CryptoJS.SHA256(input); break;
            default: return;
        }
        setOutput(hash.toString(CryptoJS.enc.Hex));
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(output);
        toast({ title: 'Copied!', description: 'Hash copied to clipboard.' });
    };

    return (
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="hash-input">Input</Label>
                <Textarea id="hash-input" value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="Text to hash..." />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                    <Label htmlFor="hash-algo">Algorithm</Label>
                    <Select value={algorithm} onValueChange={setAlgorithm}>
                        <SelectTrigger id="hash-algo"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="md5">MD5</SelectItem>
                            <SelectItem value="sha1">SHA-1</SelectItem>
                            <SelectItem value="sha256">SHA-256</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleGenerate}>Generate Hash</Button>
            </div>
            {output && (
                <div className="space-y-2">
                    <Label>Output</Label>
                     <div className="relative">
                        <Textarea value={output} readOnly rows={2} className="pr-10 font-mono text-xs" />
                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={handleCopy}><Copy className="h-4 w-4" /></Button>
                    </div>
                </div>
            )}
        </CardContent>
    );
}

function JsonFormatter() {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const { toast } = useToast();
    
    const handleFormat = () => {
        try {
            const parsed = JSON.parse(input);
            setInput(JSON.stringify(parsed, null, 2));
            setError('');
        } catch(e: any) {
            setError(e.message);
        }
    };
    
    const handleCopy = () => {
        navigator.clipboard.writeText(input);
        toast({ title: 'Copied!', description: 'JSON copied to clipboard.' });
    };
    
    return (
         <CardContent className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="json-input">JSON Input</Label>
                <div className="relative">
                    <Textarea id="json-input" value={input} onChange={(e) => setInput(e.target.value)} rows={10} placeholder='{ "key": "value" }' className="font-mono"/>
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={handleCopy} disabled={!input || !!error}><Copy className="h-4 w-4" /></Button>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button onClick={handleFormat}>Format / Validate</Button>
        </CardContent>
    );
}

function LoremIpsumGenerator() {
    const [output, setOutput] = useState('');
    const { toast } = useToast();
    const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

    const handleGenerate = () => setOutput(lorem);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(output);
        toast({ title: 'Copied!', description: 'Text copied to clipboard.' });
    };
    
    return (
         <CardContent className="space-y-4">
             <div className="space-y-2">
                <Label>Output</Label>
                <div className="relative">
                     <Textarea value={output} readOnly rows={8} className="pr-10" />
                     <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={handleCopy} disabled={!output}><Copy className="h-4 w-4" /></Button>
                </div>
            </div>
            <Button onClick={handleGenerate}>Generate</Button>
        </CardContent>
    );
}

function UrlParser() {
    const [url, setUrl] = useState('');
    const [parsed, setParsed] = useState<URL | null>(null);
    const [error, setError] = useState('');
    const { toast } = useToast();

    const handleParse = () => {
        if (!url) return;
        try {
            const parsedUrl = new URL(url);
            setParsed(parsedUrl);
            setError('');
        } catch(e: any) {
            setParsed(null);
            setError('Invalid URL');
        }
    };
    
    return (
         <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="url-input">URL</Label>
                <div className="flex gap-2">
                    <Textarea id="url-input" value={url} onChange={(e) => setUrl(e.target.value)} rows={1} placeholder="https://example.com/path?query=1" />
                    <Button onClick={handleParse}>Parse</Button>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            {parsed && (
                <div className="space-y-2">
                    <Label>Components</Label>
                    <div className="space-y-1 rounded-md border p-2 text-sm font-mono">
                        {Object.entries({
                            href: parsed.href,
                            protocol: parsed.protocol,
                            hostname: parsed.hostname,
                            port: parsed.port,
                            pathname: parsed.pathname,
                            search: parsed.search,
                            hash: parsed.hash,
                        }).map(([key, value]) => value ? (
                            <div key={key} className="flex"><span className="w-24 text-muted-foreground">{key}:</span><span>{value}</span></div>
                        ) : null)}
                    </div>
                </div>
            )}
         </CardContent>
    );
}


// --- Main component ---

const tools = [
    { id: 'base64', title: 'Base64 Converter', description: 'Encode and decode Base64 strings.', component: Base64Converter },
    { id: 'hash', title: 'Hash Generator', description: 'Generate MD5, SHA-1, SHA-256 hashes.', component: HashGenerator },
    { id: 'json', title: 'JSON Formatter', description: 'Validate and format JSON data.', component: JsonFormatter },
    { id: 'lorem', title: 'Lorem Ipsum Generator', description: 'Create placeholder text.', component: LoremIpsumGenerator },
    { id: 'url', title: 'URL Parser', description: 'Break down a URL into its components.', component: UrlParser },
];

export function ToolsView() {
    return (
        <div className="p-4 space-y-4">
            {tools.map(tool => {
                const ToolComponent = tool.component;
                return (
                    <Card key={tool.id}>
                        <CardHeader>
                            <CardTitle>{tool.title}</CardTitle>
                            <CardDescription>{tool.description}</CardDescription>
                        </CardHeader>
                        <ToolComponent />
                    </Card>
                )
            })}
        </div>
    );
}
