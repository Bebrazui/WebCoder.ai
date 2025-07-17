// src/components/markdown-previewer.tsx
"use client";

import ReactMarkdown from 'react-markdown';
import { ScrollArea } from './ui/scroll-area';

interface MarkdownPreviewerProps {
    content: string;
}

export function MarkdownPreviewer({ content }: MarkdownPreviewerProps) {
    return (
        <ScrollArea className="h-full">
            <div className="prose dark:prose-invert prose-lg p-8 max-w-full">
                <ReactMarkdown>{content}</ReactMarkdown>
            </div>
        </ScrollArea>
    );
}
