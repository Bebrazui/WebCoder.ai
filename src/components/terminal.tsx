
"use client";

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useTheme } from './theme-provider';

const PROMPT = 'WebCoder $ ';

const commands: Record<string, { description: string; output: string[] | ((term: Terminal) => void) }> = {
    'help': {
        description: 'Shows this help message.',
        output: [
            '',
            'WebCoder.ai Simulated Terminal',
            '-------------------------------',
            'This is a lightweight terminal built into the IDE.',
            'It does not have access to your computer\'s real shell.',
            '',
            'Available commands:',
            '  help        - Shows this help message.',
            '  clear       - Clears the terminal screen.',
            '  info        - Shows project information.',
            ''
        ]
    },
    'info': {
        description: 'Shows project information.',
        output: [
            '',
            'Environment: Next.js + React',
            'Execution: Via server-side language runners',
            'UI: ShadCN + TailwindCSS',
            '',
        ]
    },
    'clear': {
        description: 'Clears the terminal screen.',
        output: (term: Terminal) => {
            term.clear();
        }
    }
};

const themes = {
    dark: {
        background: '#1e293b', // slate-800
        foreground: '#f8fafc', // slate-50
        cursor: '#f8fafc',
    },
    oceanic: {
        background: '#0d1f2d', // Custom
        foreground: '#c0d2e0', // Custom
        cursor: '#c0d2e0',
    }
}

export function TerminalView() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termInstance = useRef<{ term: Terminal; fitAddon: FitAddon } | null>(null);
    const { theme } = useTheme();

    useEffect(() => {
        let currentLine = '';

        if (terminalRef.current && !termInstance.current) {
            const term = new Terminal({
                cursorBlink: true,
                convertEol: true,
                fontFamily: `'Source Code Pro', monospace`,
                fontSize: 14,
                theme: themes[theme as keyof typeof themes] || themes.dark
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current);

            termInstance.current = { term, fitAddon };

            term.writeln('Welcome to WebCoder.ai Terminal!');
            term.writeln("Type `help` to see available commands.");
            term.write(PROMPT);

            term.onKey(({ key, domEvent }) => {
                if (domEvent.key === 'Enter') {
                    if (currentLine.trim()) {
                        term.writeln('');
                        const commandHandler = commands[currentLine.trim().toLowerCase()];
                        if (commandHandler) {
                             const { output } = commandHandler;
                             if (Array.isArray(output)) {
                                output.forEach(line => term.writeln(line));
                             } else {
                                output(term);
                             }
                        } else {
                            term.writeln(`command not found: ${currentLine.trim()}`);
                        }
                    }
                    term.write(`\r\n${PROMPT}`);
                    currentLine = '';
                } else if (domEvent.key === 'Backspace') {
                     if (currentLine.length > 0) {
                        term.write('\b \b');
                        currentLine = currentLine.slice(0, -1);
                    }
                } else if (!domEvent.ctrlKey && !domEvent.altKey && !domEvent.metaKey) {
                    term.write(key);
                    currentLine += key;
                }
            });

            // Fit the terminal when the component mounts and the container is ready.
             const resizeObserver = new ResizeObserver(() => {
                try {
                    // Use requestAnimationFrame to avoid errors during layout changes
                    requestAnimationFrame(() => fitAddon.fit());
                } catch(e) {
                    // This can sometimes fail if the terminal is hidden. Ignore.
                }
             });
             if (terminalRef.current) {
                resizeObserver.observe(terminalRef.current);
             }
            
             // Initial fit
             setTimeout(() => fitAddon.fit(), 10);
            
             return () => {
                resizeObserver.disconnect();
                term.dispose();
                termInstance.current = null;
            };
        }
    }, [theme]); // Rerun on theme change

    useEffect(() => {
        if (termInstance.current) {
            termInstance.current.term.options.theme = themes[theme as keyof typeof themes] || themes.dark;
        }
    }, [theme]);

    return <div ref={terminalRef} className="h-full w-full p-2 bg-background" />;
}
