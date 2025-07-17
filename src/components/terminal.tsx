// src/components/terminal.tsx
"use client";

import React, { useEffect, useRef } from 'react';
import { Terminal as XtermTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useTheme } from './theme-provider';
import { useVfs } from '@/hooks/use-vfs';
import { useAppState } from '@/hooks/use-app-state';

const themes = {
    dark: {
        background: '#1e293b', // slate-800
        foreground: '#f8fafc', // slate-50
        cursor: '#f8fafc',
        selectionBackground: '#475569',
        brightBlack: '#64748b' // slate-500 for comments
    },
    oceanic: {
        background: '#0d1f2d', // Custom
        foreground: '#c0d2e0', // Custom
        cursor: '#c0d2e0',
        selectionBackground: '#2c3e50',
        brightBlack: '#5a6e7e'
    }
}

// Minimal path functions for cd command
const path = {
    resolve: (...paths: string[]) => {
        let resolvedPath = paths.shift() || '';
        for (const p of paths) {
            if (p === '..') {
                resolvedPath = resolvedPath.substring(0, resolvedPath.lastIndexOf('/'));
                if (!resolvedPath) resolvedPath = '/';
            } else if (p !== '.') {
                 if (resolvedPath === '/') resolvedPath = '';
                 resolvedPath = `${resolvedPath}/${p}`;
            }
        }
        return resolvedPath || '/';
    }
};

export function TerminalView() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termInstance = useRef<{ term: XtermTerminal; fitAddon: FitAddon } | null>(null);
    const { theme } = useTheme();
    const { isElectron } = useAppState();
    const { vfsRoot } = useVfs(); // To get the project root path for commands

    // We manage the CWD client-side to avoid complexity with the main process.
    // This assumes a single terminal instance.
    const cwd = useRef('/');

    const writePrompt = () => {
        if(termInstance.current) {
            termInstance.current.term.write(`\r\n\x1b[1;32mwebcoder\x1b[0m:\x1b[1;34m${cwd.current}\x1b[0m$ `);
        }
    }
    
    useEffect(() => {
        if (!terminalRef.current || !isElectron) return;

        // Initialize terminal only once
        if (!termInstance.current) {
            const term = new XtermTerminal({
                cursorBlink: true,
                convertEol: true,
                fontFamily: `'Source Code Pro', monospace`,
                fontSize: 14,
                theme: themes[theme as keyof typeof themes] || themes.dark,
                allowProposedApi: true
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current);
            termInstance.current = { term, fitAddon };

            term.writeln('Welcome to the REAL WebCoder.ai Terminal!');
            term.writeln('You can now run system commands like `npm install`, `git status`, etc.');
            term.writeln('');
            writePrompt();

            let currentCommand = '';
            
            // --- IPC Listeners ---
            window.electronAPI.onTerminalOutput((data: string) => {
                term.write(data.replace(/\n/g, '\r\n'));
            });

            window.electronAPI.onTerminalCommandComplete((code: number) => {
                // Command finished, write a new prompt
                writePrompt();
            });


            term.onKey(({ key, domEvent }) => {
                const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

                if (domEvent.key === 'Enter') {
                    if (currentCommand.trim()) {
                        const [command, ...args] = currentCommand.trim().split(/\s+/);
                        
                        // Client-side command handling for 'cd' and 'clear'
                        if (command === 'clear') {
                            term.clear();
                            writePrompt();
                        } else if (command === 'cd') {
                            const newDir = args[0] || '/';
                            // This is a simplified resolver. A real one would be more robust.
                            const resolvedPath = path.resolve(cwd.current, newDir);
                            
                            // Here you would check if directory exists in VFS, for now we just set it
                            cwd.current = resolvedPath;
                            term.writeln('');
                            writePrompt();
                        } else {
                            // Execute system command
                            term.writeln(''); // Move to next line before execution
                            window.electronAPI.executeCommand(command, args, cwd.current);
                        }
                    } else {
                       writePrompt();
                    }
                    currentCommand = '';
                } else if (domEvent.key === 'Backspace') {
                    if (currentCommand.length > 0) {
                        term.write('\b \b');
                        currentCommand = currentCommand.slice(0, -1);
                    }
                } else if (domEvent.ctrlKey && domEvent.key === 'c') {
                    // Send kill signal for Ctrl+C
                    window.electronAPI.killProcess();
                } else if (printable) {
                    currentCommand += key;
                    term.write(key);
                }
            });

            // Resize observer
            const resizeObserver = new ResizeObserver(() => {
                try {
                    if (terminalRef.current && terminalRef.current.clientWidth > 0) {
                        requestAnimationFrame(() => fitAddon.fit());
                    }
                } catch(e) {}
            });
            resizeObserver.observe(terminalRef.current);
            
            // Initial fit
            setTimeout(() => fitAddon.fit(), 100);
        }

        // Handle theme changes
        if (termInstance.current) {
            termInstance.current.term.options.theme = themes[theme as keyof typeof themes] || themes.dark;
        }

    }, [theme, isElectron]); // Rerun if theme or electron status changes

    if (!isElectron) {
        return (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground p-4 text-center">
                <p>The interactive terminal is only available in the Electron desktop app.</p>
            </div>
        )
    }

    return <div ref={terminalRef} className="h-full w-full p-2 bg-background" />;
}
