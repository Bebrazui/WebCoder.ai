// main.js
const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require("electron-updater");
const createMenuTemplate = require('./menu.js');
const { spawn } = require('child_process');

let childProcess = null;

const isDev = !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: isDev ? 1600 : 1200,
    height: isDev ? 900 : 800,
    minWidth: 940,
    minHeight: 560,
    frame: false, // Important for custom title bar
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
    },
    backgroundColor: '#1e293b', // A dark background color
    show: false, // Don't show the window until it's ready
  });

  // Enable DevTools for debugging
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Gracefully show the window when it's ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });


  // This is the URL that will be loaded into the BrowserWindow
  const startUrl = isDev
    ? 'http://localhost:9002' // Dev server URL
    : `file://${path.join(__dirname, '../out/index.html')}`; // Production build path

  mainWindow.loadURL(startUrl);

  const menu = Menu.buildFromTemplate(createMenuTemplate(app, mainWindow));
  Menu.setApplicationMenu(menu);

  // --- IPC Handlers for custom title bar ---
  ipcMain.on('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow.close();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:isMaximized', true);
  });
  
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:isMaximized', false);
  });
  
  // --- Terminal IPC ---
  ipcMain.on('execute-command', (event, { command, args, cwd }) => {
    // Kill existing process if any
    if (childProcess) {
        childProcess.kill();
        childProcess = null;
    }

    try {
        const effectiveCwd = cwd || (isDev ? process.cwd() : app.getPath('home'));

        childProcess = spawn(command, args, {
            cwd: effectiveCwd,
            shell: true, // Use shell to handle complex commands and PATH resolution
            stdio: ['pipe', 'pipe', 'pipe'] // a stream for stdin, stdout, and stderr
        });

        childProcess.stdout.on('data', (data) => {
            event.sender.send('terminal-output', data.toString());
        });

        childProcess.stderr.on('data', (data) => {
            event.sender.send('terminal-output', `\x1b[31m${data.toString()}\x1b[0m`);
        });

        childProcess.on('close', (code) => {
            event.sender.send('terminal-command-complete', code);
            childProcess = null;
        });

        childProcess.on('error', (err) => {
            event.sender.send('terminal-output', `\x1b[31mError: ${err.message}\x1b[0m`);
            event.sender.send('terminal-command-complete', 1);
            childProcess = null;
        });
    } catch(err) {
       event.sender.send('terminal-output', `\x1b[31mSpawn Error: ${err.message}\x1b[0m`);
       event.sender.send('terminal-command-complete', 1);
       childProcess = null;
    }
  });
  
  ipcMain.on('terminal-input', (event, data) => {
    if (childProcess && childProcess.stdin.writable) {
        childProcess.stdin.write(data);
    }
  });

  ipcMain.on('terminal-kill', () => {
    if (childProcess) {
        childProcess.kill();
        childProcess = null;
    }
  });
  
   autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update available',
        message: 'A new version of WebCoder.ai is available. Do you want to download and install it now?',
        buttons: ['Yes', 'No']
    }).then(result => {
        if (result.response === 0) {
            autoUpdater.downloadUpdate();
        }
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: 'Install & restart now?',
        buttons: ['Yes', 'Later']
    }).then(result => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
  });

  // --- File association and deep linking ---
  let deepLinkUrl;

  if (isDev && process.platform === 'win32') {
    // Set the AppUserModelID for dev mode on Windows
    app.setAppUserModelId(process.execPath);
  } else {
     // For packaged app, the ID is usually derived from package.json
     // This line might not be necessary if build.appId is set correctly.
  }

  // Handle file open requests (e.g., "Open with" from OS)
  app.on('open-file', (event, path) => {
    event.preventDefault();
    if (app.isReady()) {
      mainWindow.webContents.send('open-path', path);
    } else {
      deepLinkUrl = path; // Store it to open after ready
    }
  });
  
  // Handle URL open requests (e.g., webcoder:// protocol)
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const path = url.replace('webcoder://', '');
    if (app.isReady()) {
      mainWindow.webContents.send('open-path', path);
    } else {
      deepLinkUrl = path;
    }
  });
  
  // When the window is ready, check if there was a file/url to open
  mainWindow.webContents.on('did-finish-load', () => {
    if (deepLinkUrl) {
      mainWindow.webContents.send('open-path', deepLinkUrl);
      deepLinkUrl = null;
    }
  });


  return mainWindow;
}


app.whenReady().then(() => {
  const mainWindow = createWindow();

  autoUpdater.checkForUpdatesAndNotify();

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
