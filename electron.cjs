// electron.cjs
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const createMenuTemplate = require('./menu.js');
const { spawn } = require('child_process');

// Disable auto-download of updates
autoUpdater.autoDownload = false;

let mainWindow;
let activeProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // The following lines are for frameless windows, useful for custom title bars
    // frame: false, 
    // titleBarStyle: 'hidden',
  });

  const menuTemplate = createMenuTemplate(app, mainWindow);
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  
  const startUrl = process.env.ELECTRON_START_URL || new URL('http://localhost:9002').toString();
  
  mainWindow.loadURL(startUrl).catch(err => {
    console.error('Failed to load URL:', startUrl, err);
    // Optional: Load a local file as a fallback
    // mainWindow.loadFile(path.join(__dirname, 'out/index.html'));
  });

  // Open DevTools automatically if in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Window state listeners
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:isMaximized', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:isMaximized', false);
  });
}

// --- IPC Handlers ---

ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow.close());

// Terminal command execution
ipcMain.on('execute-command', (event, { command, args, cwd }) => {
    if (activeProcess) {
        event.sender.send('terminal-output', '\r\nA process is already running.\r\n');
        return;
    }

    activeProcess = spawn(command, args, { cwd: cwd, shell: true });

    activeProcess.stdout.on('data', (data) => {
        event.sender.send('terminal-output', data.toString());
    });
    activeProcess.stderr.on('data', (data) => {
        event.sender.send('terminal-output', data.toString());
    });
    activeProcess.on('close', (code) => {
        event.sender.send('terminal-command-complete', code);
        activeProcess = null;
    });
    activeProcess.on('error', (err) => {
        event.sender.send('terminal-output', `\r\nError: ${err.message}\r\n`);
        event.sender.send('terminal-command-complete', 1);
        activeProcess = null;
    });
});

ipcMain.on('terminal-input', (event, data) => {
    if (activeProcess && activeProcess.stdin.writable) {
        activeProcess.stdin.write(data);
    }
});

ipcMain.on('terminal-kill', () => {
    if (activeProcess) {
        activeProcess.kill();
        activeProcess = null;
    }
});


// --- App Lifecycle ---

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  // This is a minimal check. For a real app, you'd want more robust update logic.
  // autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle file open events (e.g., from dragging a file onto the dock icon on macOS)
app.on('open-file', (event, path) => {
    event.preventDefault();
    if (mainWindow) {
        mainWindow.webContents.send('open-path', path);
    }
});
app.on('open-url', (event, url) => {
    event.preventDefault();
     if (mainWindow) {
        mainWindow.webContents.send('open-path', url);
    }
});

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('webcoder', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('webcoder');
}
```