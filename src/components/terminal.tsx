
"use client";

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useTheme } from './theme-provider';
import { useVfs } from '@/hooks/use-vfs';
import type { VFSNode, VFSDirectory } from '@/lib/vfs';

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

class XtermVfsApi {
    private term: Terminal;
    private vfs: ReturnType<typeof useVfs>;
    private _cwd: string = '/';
    private _cwdNode: VFSDirectory;

    constructor(term: Terminal, vfs: ReturnType<typeof useVfs>) {
        this.term = term;
        this.vfs = vfs;
        this._cwdNode = vfs.vfsRoot;
    }

    get cwd(): string { return this._cwd; }

    private _updateCwdNode() {
        const result = this.vfs.findNodeByPath(this._cwd);
        if (result && result.type === 'directory') {
            this._cwdNode = result;
        } else {
            this._cwd = '/';
            this._cwdNode = this.vfs.vfsRoot;
            this.term.writeln('\x1b[31mError: CWD not found, resetting to root.\x1b[0m');
        }
    }

    private _resolvePath(inputPath: string): string {
        if (!inputPath) return this._cwd;
        if (inputPath.startsWith('/')) return inputPath; // Absolute path

        const parts = (this._cwd === '/' ? '' : this._cwd).split('/').concat(inputPath.split('/')).filter(p => p);
        const resolvedParts: string[] = [];

        for (const part of parts) {
            if (part === '..') {
                resolvedParts.pop();
            } else if (part !== '.') {
                resolvedParts.push(part);
            }
        }
        return '/' + resolvedParts.join('/');
    }

    ls = (path: string = '.') => {
        const targetPath = this._resolvePath(path);
        const node = this.vfs.findNodeByPath(targetPath);
        if (!node) {
            this.term.writeln(`\x1b[31mError: No such file or directory: ${path}\x1b[0m`);
            return;
        }
        if (node.type === 'file') {
            this.term.writeln(node.name);
            return;
        }
        node.children.forEach(child => {
            const color = child.type === 'directory' ? '\x1b[1;34m' : '\x1b[0m';
            const resetColor = '\x1b[0m';
            this.term.writeln(`${color}${child.name}${resetColor}`);
        });
    };

    cd = (path: string) => {
        const targetPath = this._resolvePath(path);
        const node = this.vfs.findNodeByPath(targetPath);
        if (node && node.type === 'directory') {
            this._cwd = targetPath;
            this._cwdNode = node;
        } else {
            this.term.writeln(`\x1b[31mError: No such directory: ${path}\x1b[0m`);
        }
    };

    pwd = () => this.term.writeln(this._cwd);

    cat = (path: string) => {
        const targetPath = this._resolvePath(path);
        const node = this.vfs.findNodeByPath(targetPath);
        if (node && node.type === 'file') {
            if (node.content.startsWith('data:')) {
                this.term.writeln('\x1b[33m(Binary content, showing data URI)\x1b[0m');
            }
            this.term.writeln(node.content.replace(/\n/g, '\r\n'));
        } else {
            this.term.writeln(`\x1b[31mError: Not a file or not found: ${path}\x1b[0m`);
        }
    };
    
    mkdir = (name: string) => {
        this._updateCwdNode();
        this.vfs.createDirectoryInVfs(name, this._cwdNode);
    }
    
    touch = (name: string) => {
        this._updateCwdNode();
        this.vfs.createFileInVfs(name, this._cwdNode);
    }
}

export function TerminalView() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termInstance = useRef<{ term: Terminal; fitAddon: FitAddon } | null>(null);
    const apiRef = useRef<XtermVfsApi | null>(null);
    const { theme } = useTheme();
    const vfs = useVfs();
    const [prompt, setPrompt] = useState('WebCoder $ ');

    useEffect(() => {
        if(apiRef.current) {
            setPrompt(`WebCoder (\x1b[1;36m${apiRef.current.cwd}\x1b[0m) $ `)
        }
    }, [apiRef.current?.cwd, vfs.vfsRoot]);


    const commands = useMemo(() => ({
        help: {
            description: 'Shows this help message.',
            action: (term: Terminal) => {
                term.writeln('WebCoder.ai Interactive Terminal');
                term.writeln('--------------------------------');
                term.writeln('Available commands:');
                Object.entries(commands).forEach(([key, { description }]) => {
                    term.writeln(`  \x1b[1;32m${key.padEnd(10)}\x1b[0m - ${description}`);
                });
                term.writeln('\nAny other input will be evaluated as JavaScript.');
            }
        },
        clear: { description: 'Clears the terminal screen.', action: (term: Terminal) => term.clear() },
        ls: { description: 'Lists files in a directory.', action: (_: any, args: string[]) => apiRef.current?.ls(args[0]) },
        cd: { description: 'Changes the current directory.', action: (_: any, args: string[]) => apiRef.current?.cd(args[0]) },
        pwd: { description: 'Prints the current working directory.', action: () => apiRef.current?.pwd() },
        cat: { description: 'Displays file content.', action: (_: any, args: string[]) => apiRef.current?.cat(args[0]) },
        mkdir: { description: 'Creates a new directory.', action: (_: any, args: string[]) => apiRef.current?.mkdir(args[0]) },
        touch: { description: 'Creates a new empty file.', action: (_: any, args: string[]) => apiRef.current?.touch(args[0]) },
        echo: {
            description: 'Prints arguments to the terminal.',
            action: (term: Terminal, args: string[]) => term.writeln(args.join(' '))
        },
    }), [apiRef.current]);

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
                theme: themes[theme as keyof typeof themes] || themes.dark,
                allowProposedApi: true
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current);

            termInstance.current = { term, fitAddon };
            apiRef.current = new XtermVfsApi(term, vfs);

            term.writeln('Welcome to WebCoder.ai Terminal!');
            term.writeln("Type `help` to see available commands.");
            term.write(prompt);

            const handleCommand = (line: string) => {
                const [command, ...args] = line.trim().split(/\s+/);
                const commandHandler = commands[command.toLowerCase() as keyof typeof commands];
                if (commandHandler) {
                    commandHandler.action(term, args);
                } else {
                    try {
                        // Use Function for safer eval
                        const result = new Function(`return ${line}`)();
                        if (result !== undefined) {
                            term.writeln(JSON.stringify(result, null, 2).replace(/\n/g, '\r\n'));
                        }
                    } catch (e: any) {
                        term.writeln(`\x1b[31m${e.message}\x1b[0m`);
                    }
                }
            };
            
            term.onKey(({ key, domEvent }) => {
                const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

                switch (domEvent.key) {
                    case 'Enter':
                        if (currentLine.trim()) {
                            commandHistory.push(currentLine);
                            historyIndex = commandHistory.length;
                            term.writeln('');
                            handleCommand(currentLine);
                        }
                        term.write(`\r\n${prompt}`);
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
                            term.write('\x1b[2K\r' + prompt + newCommand);
                            currentLine = newCommand;
                        }
                        break;
                    case 'ArrowDown':
                         if (historyIndex < commandHistory.length - 1) {
                            historyIndex++;
                            const newCommand = commandHistory[historyIndex];
                            term.write('\x1b[2K\r' + prompt + newCommand);
                            currentLine = newCommand;
                        } else {
                            historyIndex = commandHistory.length;
                            term.write('\x1b[2K\r' + prompt);
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
                apiRef.current = null;
            };
        }
    }, [theme, commands, vfs, prompt]);

    useEffect(() => {
        if (termInstance.current) {
            termInstance.current.term.options.theme = themes[theme as keyof typeof themes] || themes.dark;
        }
    }, [theme]);

    useEffect(() => {
        if(termInstance.current) {
            termInstance.current.term.write('\x1b[2K\r' + prompt);
        }
    }, [prompt])

    return <div ref={terminalRef} className="h-full w-full p-2 bg-background" />;
}
