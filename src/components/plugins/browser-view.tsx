// src/components/plugins/browser-view.tsx
"use client";

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, ArrowLeft, ArrowRight, RotateCw, Home, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrowserView() {
    const [url, setUrl] = useState('https://www.google.com/webhp?igu=1');
    const [inputValue, setInputValue] = useState(url);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const handleGo = () => {
        let finalUrl = inputValue.trim();
        if (!finalUrl) return;

        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            // Check if it's a localhost URL
            if (/^localhost(:\d+)?/.test(finalUrl)) {
                finalUrl = 'http://' + finalUrl;
            } else if (/\S\.\S/.test(finalUrl)) {
                 finalUrl = 'https://' + finalUrl;
            } else {
                // Simple search query
                finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
            }
        }
        setUrl(finalUrl);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleGo();
        }
    };
    
    const goBack = () => iframeRef.current?.contentWindow?.history.back();
    const goForward = () => iframeRef.current?.contentWindow?.history.forward();
    const reload = () => iframeRef.current?.contentWindow?.location.reload();
    const goHome = () => {
        const homeUrl = 'https://www.google.com/webhp?igu=1';
        setUrl(homeUrl);
        setInputValue(homeUrl);
    }
    const clearUrl = () => setInputValue('');


    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            <div className="p-2 border-b border-border flex-shrink-0">
                <h2 className="text-lg font-headline font-semibold flex items-center gap-2 mb-2">
                    <Globe className="h-5 w-5" />
                    <span>Web Browser</span>
                </h2>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}><ArrowLeft/></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goForward}><ArrowRight/></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reload}><RotateCw/></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goHome}><Home/></Button>
                    <div className="relative flex-grow">
                        <Input 
                            value={inputValue} 
                            onChange={(e) => setInputValue(e.target.value)} 
                            onKeyDown={handleKeyDown}
                            placeholder="Enter URL or search query"
                            className="h-9 pr-8"
                        />
                         {inputValue && <X className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" onClick={clearUrl}/>}
                    </div>
                    <Button onClick={handleGo} size="sm" className="h-9">Go</Button>
                </div>
            </div>
            <div className="flex-grow bg-muted/20 relative">
                 <iframe
                    ref={iframeRef}
                    src={url}
                    className="w-full h-full border-0"
                    title="Web Browser"
                    sandbox="allow-scripts allow-forms allow-same-origin"
                    onLoad={() => {
                        try {
                           const currentSrc = iframeRef.current?.contentWindow?.location.href;
                           if (currentSrc && currentSrc !== 'about:blank') {
                             setInputValue(currentSrc);
                           }
                        } catch(e) {
                            // Cross-origin error, we can't access the location, which is expected.
                            // We just don't update the input value.
                        }
                    }}
                ></iframe>
            </div>
        </div>
    );
}
