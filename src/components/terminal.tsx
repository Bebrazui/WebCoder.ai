
"use client";

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useTheme } from './theme-provider';
import { useVfs } from '@/hooks/use-vfs';
import type { VFSNode, VFSDirectory, VFSFile } from '@/lib/vfs';

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
    private executeSystemCommand: (command: string, args: string[]) => Promise<{ stdout: string, stderr: string, code: number | null }>;

    constructor(term: Terminal, vfs: ReturnType<typeof useVfs>, executeSystemCommand: (command: string, args: string[]) => Promise<{ stdout: string, stderr: string, code: number | null }>) {
        this.term = term;
        this.vfs = vfs;
        this._cwdNode = vfs.vfsRoot;
        this.executeSystemCommand = executeSystemCommand;
    }

    get cwd(): string { return this._cwd; }
    
    public async handleExternalCommand(command: string, args: string[]) {
        this.term.writeln(`\x1b[90mExecuting: ${command} ${args.join(' ')}...\x1b[0m`);
        const result = await this.executeSystemCommand(command, args);
        if (result.stdout) {
            this.term.write(result.stdout.replace(/\n/g, '\r\n'));
        }
        if (result.stderr) {
            this.term.write(`\x1b[31m${result.stderr.replace(/\n/g, '\r\n')}\x1b[0m`);
        }
    }

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

    public _resolvePath(inputPath: string): string {
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

    cp = (source: string, dest: string) => {
        const sourcePath = this._resolvePath(source);
        const destPath = this._resolvePath(dest);
        const sourceNode = this.vfs.findNodeByPath(sourcePath);
        if (!sourceNode) {
            this.term.writeln(`\x1b[31mError: Source file not found: ${source}\x1b[0m`);
            return;
        }
        if (sourceNode.type === 'directory') {
             this.term.writeln(`\x1b[31mError: cp for directories not supported yet. Use cp -r.\x1b[0m`);
             return;
        }
        
        let destDirNode: VFSNode | null = this.vfs.findNodeByPath(destPath);
        let destFileName = sourceNode.name;
        let finalDestPath: string;

        if (destDirNode && destDirNode.type === 'directory') { // copy into dir
            finalDestPath = destPath;
        } else { // copy to file path
            finalDestPath = path.dirname(destPath);
            destFileName = path.basename(destPath);
            destDirNode = this.vfs.findNodeByPath(finalDestPath);
        }

        if (!destDirNode || destDirNode.type !== 'directory') {
            this.term.writeln(`\x1b[31mError: Destination directory not found: ${finalDestPath}\x1b[0m`);
            return;
        }
        this.vfs.createFileInVfs(destFileName, destDirNode as VFSDirectory, (sourceNode as VFSFile).content);
    }

    mv = (source: string, dest: string) => {
         const sourcePath = this._resolvePath(source);
         const destPath = this._resolvePath(dest);
         const sourceNode = this.vfs.findNodeByPath(sourcePath);
         if (!sourceNode) {
            this.term.writeln(`\x1b[31mError: Source not found: ${source}\x1b[0m`);
            return;
        }
        
        let destNode = this.vfs.findNodeByPath(destPath);
        
        // If destination is a directory, move inside it
        if(destNode && destNode.type === 'directory') {
            this.vfs.moveNodeInVfs(sourcePath, destPath);
        } else { // Else, rename to the destination path
            const newName = path.basename(destPath);
            this.vfs.renameNodeInVfs(sourceNode, newName);
        }
    }
}

// Minimal path functions for mv/cp commands
const path = {
    basename: (p: string) => p.split('/').filter(Boolean).pop() || '',
    dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
};


export function TerminalView() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termInstance = useRef<{ term: Terminal; fitAddon: FitAddon } | null>(null);
    const apiRef = useRef<XtermVfsApi | null>(null);
    const { theme } = useTheme();
    const vfs = useVfs();
    const [prompt, setPrompt] = useState('WebCoder $ ');
    const commandHistory = useRef<string[]>([]);

    useEffect(() => {
        if(apiRef.current) {
            setPrompt(`WebCoder (\x1b[1;36m${apiRef.current.cwd}\x1b[0m) $ `)
        }
    }, [apiRef.current?.cwd, vfs.vfsRoot]);


    const executeSystemCommand = async (command: string, args: string[]): Promise<{ stdout: string, stderr: string, code: number | null }> => {
        let programPath: string | undefined;
        let runnerType = '';
        const isRunner = (cmd: string) => ['python', 'python3', 'go', 'ruby', 'php'].includes(cmd);

        if (isRunner(command)) {
            if (command === 'go' && args[0] === 'run') {
                runnerType = 'go';
                args.shift(); // remove 'run'
                programPath = apiRef.current?._resolvePath(args[0]);
            } else {
                runnerType = command === 'python3' ? 'python' : command;
                programPath = apiRef.current?._resolvePath(args[0]);
            }
        } else if(command === 'run') {
             programPath = apiRef.current?._resolvePath(args[0]);
             const fileExtension = programPath?.split('.').pop();
             switch(fileExtension) {
                case 'py': runnerType = 'python'; break;
                case 'go': runnerType = 'go'; break;
                case 'rb': runnerType = 'ruby'; break;
                case 'php': runnerType = 'php'; break;
                default:
                    return { stdout: '', stderr: `Unsupported file type for 'run' command: .${fileExtension}`, code: 1 };
             }
        }


        if (!runnerType) {
            return { stdout: '', stderr: `Unknown command: ${command}`, code: 1 };
        }
         if (!programPath) {
            return { stdout: '', stderr: 'No script specified.', code: 1 };
        }
        
        const config = {
            name: `Terminal Run: ${command} ${programPath}`,
            type: runnerType,
            request: 'launch',
            command: command, // Pass the actual command used (python vs python3)
            program: programPath,
            args: {} // Terminal args parsing is complex, skipping for now.
        };

        const apiEndpoint = `/api/run-${config.type}`;
        
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectFiles: [vfs.vfsRoot],
                    config: config,
                }),
            });
            const responseData = await response.json();
            if (!response.ok || !responseData.success) {
                return { stdout: responseData.data?.stdout || '', stderr: responseData.error || responseData.data?.stderr || 'Execution failed on server.', code: 1 };
            }
            return {
                stdout: responseData.data.stdout,
                stderr: responseData.data.stderr,
                code: responseData.data.hasError ? 1 : 0
            };
        } catch (e: any) {
            return { stdout: '', stderr: e.message, code: 1 };
        }
    };


    const commands = useMemo(() => ({
        help: {
            description: 'Shows this help message.',
            action: (term: Terminal) => {
                term.writeln('WebCoder.ai Interactive Terminal');
                term.writeln('--------------------------------');
                term.writeln('\x1b[1mInternal Commands:\x1b[0m');
                Object.entries(commands).forEach(([key, { description }]) => {
                    term.writeln(`  \x1b[1;32m${key.padEnd(10)}\x1b[0m - ${description}`);
                });
                term.writeln('\n\x1b[1mExternal Commands:\x1b[0m');
                term.writeln('  \x1b[1;32mrun, python, python3, go run, ruby, php\x1b[0m');
                term.writeln('  Example: \x1b[3mrun python_scripts/my_script.py\x1b[0m');
                term.writeln('\nAny other input will be evaluated as JavaScript.');
            }
        },
        history: {
            description: 'Shows command history.',
            action: (term: Terminal) => {
                commandHistory.current.forEach((cmd, i) => {
                    term.writeln(`  ${(i + 1).toString().padStart(3)}  ${cmd}`);
                });
            }
        },
        clear: { description: 'Clears the terminal screen.', action: (term: Terminal) => term.clear() },
        ls: { description: 'Lists files in a directory.', action: (_: any, args: string[]) => apiRef.current?.ls(args[0]) },
        cd: { description: 'Changes the current directory.', action: (_: any, args: string[]) => apiRef.current?.cd(args[0]) },
        pwd: { description: 'Prints the current working directory.', action: () => apiRef.current?.pwd() },
        cat: { description: 'Displays file content.', action: (_: any, args: string[]) => apiRef.current?.cat(args[0]) },
        mkdir: { description: 'Creates a new directory.', action: (_: any, args: string[]) => apiRef.current?.mkdir(args[0]) },
        touch: { description: 'Creates a new empty file.', action: (_: any, args: string[]) => apiRef.current?.touch(args[0]) },
        cp: { description: 'Copies a file. `cp <src> <dest>`', action: (_:any, args: string[]) => apiRef.current?.cp(args[0], args[1]) },
        mv: { description: 'Moves/renames a file/dir. `mv <src> <dest>`', action: (_:any, args: string[]) => apiRef.current?.mv(args[0], args[1]) },
        echo: {
            description: 'Prints arguments to the terminal.',
            action: (term: Terminal, args: string[]) => term.writeln(args.join(' '))
        },
        run: {
            description: 'Runs a script file (e.g., run script.py).',
            action: async (_: any, args: string[]) => await apiRef.current?.handleExternalCommand('run', args)
        }
    }), [apiRef.current]);

    useEffect(() => {
        let currentLine = '';
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
            apiRef.current = new XtermVfsApi(term, vfs, executeSystemCommand);

            term.writeln('Welcome to WebCoder.ai Terminal!');
            term.writeln("Type `help` to see available commands.");
            term.write(prompt);

            const handleCommand = async (line: string) => {
                if (line.trim() === '!!') {
                    const lastCommand = commandHistory.current[commandHistory.current.length - 1];
                    if (lastCommand) {
                        term.writeln(prompt + lastCommand);
                        await handleCommand(lastCommand);
                    }
                    return;
                }

                if (line.trim()) {
                    commandHistory.current.push(line);
                }
                historyIndex = commandHistory.current.length;

                const [command, ...args] = line.trim().split(/\s+/);
                const commandHandler = commands[command.toLowerCase() as keyof typeof commands];
                
                const externalRunners = ['python', 'python3', 'go', 'ruby', 'php'];
                
                if (commandHandler) {
                    await commandHandler.action(term, args);
                } else if (externalRunners.includes(command.toLowerCase())) {
                    await apiRef.current?.handleExternalCommand(command, args);
                } else if (command.trim()) {
                    try {
                        const result = new Function(`return ${line}`)();
                        if (result !== undefined) {
                            term.writeln(JSON.stringify(result, null, 2).replace(/\n/g, '\r\n'));
                        }
                    } catch (e: any) {
                        term.writeln(`\x1b[31m${e.message}\x1b[0m`);
                    }
                }
            };
            
            term.onKey(async ({ key, domEvent }) => {
                const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

                switch (domEvent.key) {
                    case 'Enter':
                        if (currentLine.trim()) {
                           await handleCommand(currentLine);
                        }
                        term.writeln('');
                        term.write(prompt);
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
                            const newCommand = commandHistory.current[historyIndex];
                            term.write('\x1b[2K\r' + prompt + newCommand);
                            currentLine = newCommand;
                        }
                        break;
                    case 'ArrowDown':
                         if (historyIndex < commandHistory.current.length - 1) {
                            historyIndex++;
                            const newCommand = commandHistory.current[historyIndex];
                            term.write('\x1b[2K\r' + prompt + newCommand);
                            currentLine = newCommand;
                        } else {
                            historyIndex = commandHistory.current.length;
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

             const resizeObserver = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    try {
                        requestAnimationFrame(() => {
                            termInstance.current?.fitAddon.fit();
                        });
                    } catch(e) {
                         console.warn("FitAddon failed:", e);
                    }
                }
             });
             if (terminalRef.current) {
                resizeObserver.observe(terminalRef.current);
             }
            
             setTimeout(() => {
                try {
                    fitAddon.fit();
                } catch(e) {}
            }, 100);
            
             return () => {
                resizeObserver.disconnect();
                term.dispose();
                termInstance.current = null;
                apiRef.current = null;
            };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme, commands, vfs, prompt]);

    useEffect(() => {
        if (termInstance.current) {
            termInstance.current.term.options.theme = themes[theme as keyof typeof themes] || themes.dark;
        }
    }, [theme]);

    useEffect(() => {
        if(termInstance.current) {
            const term = termInstance.current.term;
            // Clear the current line and rewrite the prompt
            term.write('\x1b[2K\r' + prompt);
        }
    }, [prompt])

    return <div ref={terminalRef} className="h-full w-full p-2 bg-background" />;
}

    