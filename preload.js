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
  onIsMaximized: (callback) => ipcRenderer.on('window:isMaximized', (_event, value) => callback(value)),

  // File/path opening events from main process
  onOpenPath: (callback) => ipcRenderer.on('open-path', (_event, value) => callback(value))
});

console.log('Preload script loaded.');
