// electron.cjs
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const pty = require('node-pty');
const os = require('os');
const createMenuTemplate = require('./menu.js');

const isDev = process.env.NODE_ENV !== 'production';
const isMac = process.platform === 'darwin';

// Устанавливаем оболочку по умолчанию для node-pty
const shellCmd = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

let mainWindow;
let ptyProcess = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    titleBarStyle: isMac ? 'hidden' : 'default',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#1e293b', // slate-800
    show: false,
  });
  
  const menu = Menu.buildFromTemplate(createMenuTemplate(app, mainWindow));
  Menu.setApplicationMenu(menu);

  // mainWindow.setRepresentedFilename('/path/to/file');
  // mainWindow.setDocumentEdited(true);

  if (isDev) {
    mainWindow.loadURL('http://localhost:9002');
    mainWindow.webContents.openDevTools();
  } else {
    // Correctly load the static export from the 'out' directory
    const startUrl = new URL(path.join(__dirname, 'out', 'index.html'), 'file:').href;
    mainWindow.loadURL(startUrl);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Window state events for custom title bar
  mainWindow.on('maximize', () => {
      mainWindow.webContents.send('window:isMaximized', true);
  });

  mainWindow.on('unmaximize', () => {
      mainWindow.webContents.send('window:isMaximized', false);
  });
}

let synthesisWindow;

function createSynthesisWindow() {
    if (synthesisWindow) {
        synthesisWindow.focus();
        return;
    }

    synthesisWindow = new BrowserWindow({
        width: 500,
        height: 700,
        title: 'SYNTHESIS App Runner',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: false, // For localStorage access from main process
            sandbox: false,
        },
    });

    const runnerUrl = isDev
      ? 'http://localhost:9002/synthesis-runner'
      : new URL(path.join(__dirname, 'out', 'synthesis-runner', 'index.html'), 'file:').href;

    synthesisWindow.loadURL(runnerUrl);
    
    // if(isDev) synthesisWindow.webContents.openDevTools();

    synthesisWindow.on('closed', () => {
        synthesisWindow = null;
    });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

app.on('open-file', (event, path) => {
    event.preventDefault();
    if(mainWindow) {
      mainWindow.webContents.send('open-path', path);
    }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  const path = url.replace('webcoder://', '');
   if(mainWindow) {
      mainWindow.webContents.send('open-path', path);
    }
});

// Window Controls
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow.close());

// Synthesis Window
ipcMain.on('synthesis:open-window', createSynthesisWindow);


// --- Terminal IPC Handling ---
ipcMain.on('execute-command', (event, { command, args, cwd }) => {
    if (ptyProcess) {
        // Kill existing process before starting a new one
        ptyProcess.kill();
    }

    ptyProcess = pty.spawn(command, args, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: cwd || process.env.HOME,
        env: process.env,
    });
    
    ptyProcess.onData(data => {
        event.sender.send('terminal-output', data);
    });

    ptyProcess.onExit(({ exitCode }) => {
        event.sender.send('terminal-command-complete', exitCode);
        ptyProcess = null;
    });
});

ipcMain.on('terminal-input', (event, data) => {
    if (ptyProcess) {
        ptyProcess.write(data);
    }
});

ipcMain.on('terminal-kill', () => {
    if (ptyProcess) {
        ptyProcess.kill();
        ptyProcess = null;
    }
});
