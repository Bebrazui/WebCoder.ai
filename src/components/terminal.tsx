
"use client";

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const PROMPT = '$ ';

const commands: Record<string, { description: string; output: string[] | ((term: Terminal) => void) }> = {
    'help': {
        description: 'Shows this help message.',
        output: [
            'Available commands:',
            '  help        - Shows this help message.',
            '  npm install - Simulates installing dependencies.',
            '  npm run dev - Simulates running the development server.',
            '  clear       - Clears the terminal screen.',
        ]
    },
    'npm install': {
        description: 'Simulates installing dependencies.',
        output: async (term: Terminal) => {
            term.writeln('Simulating package installation...');
            await new Promise(res => setTimeout(res, 500));
            term.writeln('added 350 packages, and audited 351 packages in 10s');
            term.writeln('42 packages are looking for funding');
            term.writeln('  run `npm fund` for details');
            term.writeln('found 0 vulnerabilities');
        }
    },
    'npm run dev': {
        description: 'Simulates running the development server.',
        output: [
            '> next dev --turbopack -p 9002',
            '',
            '  ▲ Next.js 15.3.3',
            '  - Local:        http://localhost:9002',
            '  - Environments: .env',
            '',
            ' ✓ Ready in 459ms',
            ' ✓ Compiled / in 227ms (245 modules)',
            '',
            'This is a simulated server. To see your app, please use your browser\'s preview feature.',
        ]
    },
    'clear': {
        description: 'Clears the terminal screen.',
        output: (term: Terminal) => {
            term.clear();
        }
    }
};

export function TerminalView() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const term = useRef<Terminal | null>(null);
    const fitAddon = useRef<FitAddon | null>(null);

    useEffect(() => {
        let currentLine = '';

        if (terminalRef.current && !term.current) {
            const xterm = new Terminal({
                cursorBlink: true,
                convertEol: true,
                fontFamily: `'Source Code Pro', monospace`,
                fontSize: 14,
                theme: {
                    background: '#1e293b', // slate-800
                    foreground: '#f8fafc', // slate-50
                    cursor: '#f8fafc',
                }
            });

            fitAddon.current = new FitAddon();
            xterm.loadAddon(fitAddon.current);

            xterm.open(terminalRef.current);

            xterm.writeln('Welcome to WebCoder.ai Terminal!');
            xterm.writeln('Type `help` to see available commands.');
            xterm.write(PROMPT);

            xterm.onKey(({ key, domEvent }) => {
                if (domEvent.key === 'Enter') {
                    if (currentLine.trim()) {
                        xterm.writeln('');
                        const commandHandler = commands[currentLine.trim()];
                        if (commandHandler) {
                             const { output } = commandHandler;
                             if (Array.isArray(output)) {
                                output.forEach(line => xterm.writeln(line));
                             } else {
                                output(xterm);
                             }
                        } else {
                            xterm.writeln(`command not found: ${currentLine.trim()}`);
                        }
                    }
                    xterm.write(`\r\n${PROMPT}`);
                    currentLine = '';
                } else if (domEvent.key === 'Backspace') {
                     if (currentLine.length > 0) {
                        xterm.write('\b \b');
                        currentLine = currentLine.slice(0, -1);
                    }
                } else if (!domEvent.ctrlKey && !domEvent.altKey && !domEvent.metaKey) {
                    xterm.write(key);
                    currentLine += key;
                }
            });

            term.current = xterm;

            const resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(() => {
                    try {
                        fitAddon.current?.fit();
                    } catch (e) {
                        // ignore
                    }
                });
            });

            if (terminalRef.current) {
                resizeObserver.observe(terminalRef.current);
            }

            requestAnimationFrame(() => {
                try {
                    fitAddon.current?.fit();
                } catch(e) {
                    // ignore
                }
            });

            return () => {
                resizeObserver.disconnect();
                xterm.dispose();
                term.current = null;
            };
        }
    }, []); // Empty dependency array ensures this runs only once.

    return <div ref={terminalRef} className="h-full w-full p-2" />;
}
