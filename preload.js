// preload.js

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  
  // Window state events
  onIsMaximized: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('window:isMaximized', handler);
    return () => ipcRenderer.removeListener('window:isMaximized', handler);
  },

  // File/path opening events from main process
  onOpenPath: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('open-path', handler);
    return () => ipcRenderer.removeListener('open-path', handler);
  },

  // Terminal commands
  executeCommand: (command, args, cwd) => ipcRenderer.send('execute-command', { command, args, cwd }),
  onTerminalOutput: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('terminal-output', handler);
    return () => ipcRenderer.removeListener('terminal-output', handler);
  },
  onTerminalCommandComplete: (callback) => {
    const handler = (_event, code) => callback(code);
    ipcRenderer.on('terminal-command-complete', handler);
    return () => ipcRenderer.removeListener('terminal-command-complete', handler);
  },
  sendTerminalInput: (data) => ipcRenderer.send('terminal-input', data),
  killProcess: () => ipcRenderer.send('terminal-kill'),
});

console.log('Preload script loaded with terminal API.');
