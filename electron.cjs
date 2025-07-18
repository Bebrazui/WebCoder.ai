// electron.cjs
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const createMenuTemplate = require('./menu.js');
const { spawn } = require('child_process');

let mainWindow;
let activeProcess = null; // To keep track of the running child process

// This is required to be set explicitly for sandboxed renderers
app.allowRendererProcessReuse = true;

// Disable hardware acceleration to prevent potential rendering issues
// app.disableHardwareAcceleration();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false, // Use custom title bar
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 15, y: 15 },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            devTools: process.env.NODE_ENV !== 'production'
        },
        backgroundColor: '#1e293b' // Match dark theme background
    });

    const appUrl = 'http://localhost:9002';

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL(appUrl);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'out', 'index.html'));
    }
    
    // --- Window State Management ---
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window:isMaximized', true);
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window:isMaximized', false);
    });

    return mainWindow;
}

app.whenReady().then(() => {
    autoUpdater.autoDownload = false; // Отключаем авто-обновление
    createWindow();

    const menu = Menu.buildFromTemplate(createMenuTemplate(app, mainWindow));
    Menu.setApplicationMenu(menu);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers for Window Controls ---
ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.on('window:close', () => {
    mainWindow?.close();
});


// --- IPC Handlers for Terminal ---
ipcMain.on('execute-command', (event, { command, args, cwd }) => {
    if (activeProcess) {
        mainWindow.webContents.send('terminal-output', '\r\nAnother process is already running.\r\n');
        return;
    }

    try {
        const effectiveCwd = cwd || process.cwd();
        // Use shell: true on Windows to correctly handle system commands like 'npm'
        activeProcess = spawn(command, args, { cwd: effectiveCwd, shell: process.platform === 'win32' });

        activeProcess.stdout.on('data', (data) => {
            mainWindow.webContents.send('terminal-output', data.toString());
        });

        activeProcess.stderr.on('data', (data) => {
            mainWindow.webContents.send('terminal-output', data.toString());
        });

        activeProcess.on('close', (code) => {
            mainWindow.webContents.send('terminal-command-complete', code);
            activeProcess = null;
        });

        activeProcess.on('error', (err) => {
            mainWindow.webContents.send('terminal-output', `\r\nError: ${err.message}\r\n`);
            mainWindow.webContents.send('terminal-command-complete', 1);
            activeProcess = null;
        });

    } catch (err) {
        mainWindow.webContents.send('terminal-output', `\r\nSpawn Error: ${err.message}\r\n`);
        mainWindow.webContents.send('terminal-command-complete', 1);
        activeProcess = null;
    }
});

ipcMain.on('terminal-input', (event, data) => {
    if (activeProcess) {
        activeProcess.stdin.write(data);
    }
});

ipcMain.on('terminal-kill', () => {
    if (activeProcess) {
        // Use platform-specific kill signals
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', activeProcess.pid, '/f', '/t']);
        } else {
            activeProcess.kill('SIGKILL');
        }
        activeProcess = null;
    }
});


// Deep linking for macOS and Windows
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('webcoder', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('webcoder');
}

let openUrl;

app.on('open-url', (event, url) => {
    event.preventDefault();
    const pathArg = url.replace('webcoder://', '');
    if (app.isReady()) {
        mainWindow.webContents.send('open-path', pathArg);
    } else {
        openUrl = pathArg;
    }
});

app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();

        const url = commandLine.pop()?.replace('webcoder://', '');
        if (url) {
            mainWindow.webContents.send('open-path', url);
        }
    }
});
