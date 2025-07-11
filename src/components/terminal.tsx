"use client";

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export function TerminalView() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const term = useRef<Terminal | null>(null);
    const fitAddon = useRef<FitAddon | null>(null);

    useEffect(() => {
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
            fitAddon.current.fit();

            xterm.writeln('Welcome to WebCoder.ai Terminal!');
            xterm.writeln('This is a simulated terminal environment.');
            xterm.write('$ ');

            xterm.onKey(({ key, domEvent }) => {
                if (domEvent.key === 'Enter') {
                    xterm.write('\r\n$ ');
                } else if (domEvent.key === 'Backspace') {
                     if (xterm.buffer.active.cursorX > 2) {
                        xterm.write('\b \b');
                    }
                } else {
                    xterm.write(key);
                }
            });

            term.current = xterm;

            const resizeObserver = new ResizeObserver(() => {
                fitAddon.current?.fit();
            });
            resizeObserver.observe(terminalRef.current);

            return () => {
                resizeObserver.disconnect();
                xterm.dispose();
                term.current = null;
            };
        }
    }, []);

    return <div ref={terminalRef} className="h-full w-full" />;
}
