// electron.cjs
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const createMenuTemplate = require('./menu.js');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const devServerUrl = 'http://localhost:9002';

// --- Global State ---
let mainWindow;
let synthesisWindow;
let childProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 940,
    minHeight: 560,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e293b', // slate-800
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  
  // Set up the menu
  const menuTemplate = createMenuTemplate(app, mainWindow);
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load the app
  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Correctly load the static export from Next.js
    mainWindow.loadFile(path.join(__dirname, 'out/index.html'));
  }
  
  // Window event listeners
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:isMaximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:isMaximized', false));
  mainWindow.on('closed', () => { mainWindow = null; });
}


function createSynthesisWindow() {
  if (synthesisWindow) {
    synthesisWindow.focus();
    return;
  }
  synthesisWindow = new BrowserWindow({
    width: 500,
    height: 800,
    title: 'SYNTHESIS App Runner',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    synthesisWindow.loadURL(`${devServerUrl}/synthesis-runner`);
    synthesisWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    synthesisWindow.loadFile(path.join(__dirname, 'out/synthesis-runner.html'));
  }

  synthesisWindow.on('closed', () => { synthesisWindow = null; });
}


// --- App Lifecycle ---
app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Handle opening files or directories with the app
  app.on('open-file', (event, path) => {
      event.preventDefault();
      dialog.showErrorBox('Open File', `This functionality is under development. Path: ${path}`);
      // In the future, you would send this path to the renderer process
      // mainWindow.webContents.send('open-path', path);
  });
   app.on('open-url', (event, url) => {
      event.preventDefault();
      dialog.showErrorBox('Open URL', `This functionality is under development. URL: ${url}`);
   });

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// --- IPC Handlers ---

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// Synthesis runner window
ipcMain.on('synthesis:open-window', createSynthesisWindow);


// Terminal command execution
ipcMain.on('execute-command', (event, { command, args, cwd }) => {
    if (childProcess) {
        event.sender.send('terminal-output', '\r\nAnother process is already running.\r\n');
        return;
    }

    try {
        childProcess = spawn(command, args, { cwd: cwd || require('os').homedir(), shell: true });

        childProcess.stdout.on('data', (data) => {
            event.sender.send('terminal-output', data.toString());
        });

        childProcess.stderr.on('data', (data) => {
            event.sender.send('terminal-output', data.toString());
        });

        childProcess.on('close', (code) => {
            event.sender.send('terminal-command-complete', code);
            childProcess = null;
        });

        childProcess.on('error', (err) => {
            event.sender.send('terminal-output', `\r\nError: ${err.message}\r\n`);
            event.sender.send('terminal-command-complete', 1);
            childProcess = null;
        });

    } catch (err) {
        event.sender.send('terminal-output', `\r\nFailed to start process: ${err.message}\r\n`);
        event.sender.send('terminal-command-complete', 1);
        childProcess = null;
    }
});

ipcMain.on('terminal-input', (_event, data) => {
    if (childProcess) {
        childProcess.stdin.write(data);
    }
});

ipcMain.on('terminal-kill', () => {
    if (childProcess) {
        childProcess.kill(); // Sends SIGTERM
        childProcess = null;
    }
});
