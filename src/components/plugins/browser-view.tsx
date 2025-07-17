// src/components/plugins/browser-view.tsx
"use client";

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, ArrowLeft, ArrowRight, RotateCw, Home, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// A simple CORS proxy prefix
const CORS_PROXY_PREFIX = 'https://cors-anywhere.herokuapp.com/';

export function BrowserView() {
    const [currentUrl, setCurrentUrl] = useState('https://www.google.com/webhp?igu=1');
    const [inputValue, setInputValue] = useState('https://www.google.com/webhp?igu=1');
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { toast } = useToast();

    const navigateTo = (url: string) => {
        let finalUrl = url.trim();
        if (!finalUrl) return;

        // Check if it's likely a search query vs a URL
        const isUrl = finalUrl.startsWith('http') || finalUrl.includes('.') || finalUrl.startsWith('localhost');

        if (isUrl) {
            if (!finalUrl.startsWith('http')) {
                finalUrl = 'https://' + finalUrl;
            }
        } else {
            // It's a search query
            finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
        }
        
        // Use the proxy for non-localhost URLs
        const proxiedUrl = finalUrl.startsWith('http://localhost') ? finalUrl : `${CORS_PROXY_PREFIX}${finalUrl}`;
        
        setCurrentUrl(proxiedUrl);
        setInputValue(finalUrl); // Keep the real URL in the input bar
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            navigateTo(inputValue);
        }
    };
    
    const safeExec = (action: (win: Window) => void, actionName: string) => {
        try {
            if (iframeRef.current?.contentWindow) {
                action(iframeRef.current.contentWindow);
            }
        } catch (e) {
            console.warn(`Browser action "${actionName}" blocked by cross-origin policy.`);
        }
    }
    
    const goBack = () => safeExec(win => win.history.back(), 'Go Back');
    const goForward = () => safeExec(win => win.history.forward(), 'Go Forward');
    const reload = () => {
        if (iframeRef.current) {
            // Reloading the iframe src is more reliable than contentWindow.location.reload
            iframeRef.current.src = 'about:blank';
            setTimeout(() => {
                if (iframeRef.current) {
                   iframeRef.current.src = currentUrl;
                }
            }, 50);
        }
    };
    
    const goHome = () => {
        const homeUrl = 'https://www.google.com/webhp?igu=1';
        navigateTo(homeUrl);
    }
    const clearUrl = () => setInputValue('');

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        try {
            const selection = iframeRef.current?.contentWindow?.getSelection();
            if (selection && selection.toString()) {
                e.dataTransfer.setData('text/plain', selection.toString());
            }
        } catch (err) {
            console.warn("Could not get selection from cross-origin iframe for drag event.");
            e.preventDefault();
        }
    }

    const handleIframeLoad = () => {
        try {
            const frameLocation = iframeRef.current?.contentWindow?.location.href;
            if (frameLocation && frameLocation !== 'about:blank') {
                // The URL in the iframe will be the proxied one, so we clean it up for the input bar
                const originalUrl = frameLocation.replace(CORS_PROXY_PREFIX, '');
                setInputValue(originalUrl);
            }
        } catch (e) {
            // This error is expected due to cross-origin policies. We just can't update the URL bar.
        }
    }


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
                    <Button onClick={() => navigateTo(inputValue)} size="sm" className="h-9">Go</Button>
                </div>
            </div>
            <div 
                className="flex-grow bg-muted/20 relative"
                draggable="true"
                onDragStart={handleDragStart}
            >
                 <iframe
                    ref={iframeRef}
                    src={currentUrl}
                    className="w-full h-full border-0"
                    title="Web Browser"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                    onLoad={handleIframeLoad}
                ></iframe>
            </div>
        </div>
    );
}
