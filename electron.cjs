// electron.cjs
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const createMenuTemplate = require('./menu.js');

const isDev = !app.isPackaged;
const devUrl = 'http://localhost:9002';
const prodUrl = `file://${path.join(__dirname, 'out/index.html')}`;

let mainWindow;
let fileToOpen = null; // Variable to store the file path from command line argument

// --- "Open With" Handling ---
// For Windows and Linux, the path is in process.argv.
// We need to grab it before the app is ready.
if (process.argv.length >= 2 && !isDev) {
  const openPath = process.argv[1];
  if (openPath && openPath !== '.') {
    fileToOpen = openPath;
  }
}

// For macOS, we listen for the 'open-file' event.
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (mainWindow) {
    // If the window is already open, send the path to the renderer process.
    mainWindow.webContents.send('open-path', path);
  } else {
    // If the app is not open, store the path to be opened after the window is created.
    fileToOpen = path;
  }
});


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for preload script to work
    },
    titleBarStyle: 'hidden', // For custom title bar
    trafficLightPosition: { x: 15, y: 15 }, // macOS traffic lights position
  });

  // Set up the application menu
  const menuTemplate = createMenuTemplate(app, mainWindow);
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load the app URL
  const url = isDev ? devUrl : prodUrl;
  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // After the window has finished loading, check if there's a file to open.
  mainWindow.webContents.on('did-finish-load', () => {
    if (fileToOpen) {
      mainWindow.webContents.send('open-path', fileToOpen);
      fileToOpen = null; // Clear it after sending
    }
  });

  // --- Window Control IPC Handlers ---
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
}

// Ensure the app is single-instance to handle "Open With" correctly
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Handle file passed to second instance
      const openPath = commandLine.pop();
      if (openPath && openPath !== '.') {
         mainWindow.webContents.send('open-path', openPath);
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
