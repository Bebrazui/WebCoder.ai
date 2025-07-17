
"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useTheme } from './theme-provider';
import { useVfs } from '@/hooks/use-vfs';
import type { VFSNode } from '@/lib/vfs';

const PROMPT = 'WebCoder $ ';

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
    const { vfsRoot } = useVfs();

    const commands = useMemo(() => ({
        'help': {
            description: 'Shows this help message.',
            output: (term: Terminal) => {
                term.writeln('');
                term.writeln('WebCoder.ai Simulated Terminal');
                term.writeln('-------------------------------');
                term.writeln('Available commands:');
                Object.keys(commands).forEach(key => {
                    term.writeln(`  ${key.padEnd(12)}- ${commands[key as keyof typeof commands].description}`);
                });
                term.writeln('');
            }
        },
        'info': {
            description: 'Shows project information.',
            output: (term: Terminal) => {
                term.writeln('');
                term.writeln('Environment: Next.js + React');
                term.writeln('Execution: Via server-side language runners');
                term.writeln('UI: ShadCN + TailwindCSS');
                term.writeln('');
            }
        },
        'clear': {
            description: 'Clears the terminal screen.',
            output: (term: Terminal) => {
                term.clear();
            }
        },
        'ls': {
            description: 'Lists files in the current directory.',
            output: (term: Terminal) => {
                const nodes = vfsRoot.children;
                if (nodes.length === 0) {
                    term.writeln('');
                    return;
                }
                nodes.forEach(node => {
                    const color = node.type === 'directory' ? '\x1b[1;34m' : '\x1b[0m'; // Blue for directories
                    const resetColor = '\x1b[0m';
                    term.writeln(`${color}${node.name}${resetColor}`);
                });
                 term.writeln('');
            }
        },
        'pwd': {
            description: 'Prints the current working directory.',
            output: (term: Terminal) => {
                 term.writeln('/');
                 term.writeln('');
            }
        }
    }), [vfsRoot]);

    useEffect(() => {
        let currentLine = '';
        const commandHistory: string[] = [];
        let historyIndex = -1;

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
                const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

                switch (domEvent.key) {
                    case 'Enter':
                        if (currentLine.trim()) {
                            commandHistory.push(currentLine);
                            historyIndex = commandHistory.length;
                            
                            term.writeln('');
                            const commandHandler = commands[currentLine.trim().toLowerCase() as keyof typeof commands];
                            if (commandHandler) {
                                commandHandler.output(term);
                            } else {
                                term.writeln(`command not found: ${currentLine.trim()}`);
                            }
                        }
                        term.write(`\r\n${PROMPT}`);
                        currentLine = '';
                        break;
                    case 'Backspace':
                        if (currentLine.length > 0) {
                            term.write('\b \b');
                            currentLine = currentLine.slice(0, -1);
                        }
                        break;
                    case 'ArrowUp':
                        if (historyIndex > 0) {
                            historyIndex--;
                            const newCommand = commandHistory[historyIndex];
                            term.write('\x1b[2K\r' + PROMPT + newCommand);
                            currentLine = newCommand;
                        }
                        break;
                    case 'ArrowDown':
                         if (historyIndex < commandHistory.length - 1) {
                            historyIndex++;
                            const newCommand = commandHistory[historyIndex];
                            term.write('\x1b[2K\r' + PROMPT + newCommand);
                            currentLine = newCommand;
                        } else {
                            historyIndex = commandHistory.length;
                            term.write('\x1b[2K\r' + PROMPT);
                            currentLine = '';
                        }
                        break;
                    default:
                        if (printable) {
                            term.write(key);
                            currentLine += key;
                        }
                }
            });

             const resizeObserver = new ResizeObserver(() => {
                try {
                    requestAnimationFrame(() => fitAddon.fit());
                } catch(e) { /* Ignore */ }
             });
             if (terminalRef.current) {
                resizeObserver.observe(terminalRef.current);
             }
            
             setTimeout(() => fitAddon.fit(), 100);
            
             return () => {
                resizeObserver.disconnect();
                term.dispose();
                termInstance.current = null;
            };
        }
    }, [theme, commands, vfsRoot]);

    useEffect(() => {
        if (termInstance.current) {
            termInstance.current.term.options.theme = themes[theme as keyof typeof themes] || themes.dark;
        }
    }, [theme]);

    return <div ref={terminalRef} className="h-full w-full p-2 bg-background" />;
}
