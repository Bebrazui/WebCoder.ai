// electron.cjs
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const createMenuTemplate = require('./menu.js');

const isDev = !app.isPackaged;
const devUrl = 'http://localhost:9002';
const prodUrl = `file://${path.join(__dirname, 'out', 'index.html')}`;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
  });

  // Отключаем авто-обновления для простоты
  autoUpdater.autoDownload = false;

  if (isDev) {
    mainWindow.loadURL(devUrl);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(prodUrl);
  }

  // IPC listeners
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow.close());

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:isMaximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:isMaximized', false));

  // --- SYNTHESIS WINDOW LOGIC ---
  ipcMain.on('synthesis:open-window', () => {
    const synthesisWindow = new BrowserWindow({
      width: 500,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: false, // simpler for runner
      },
      title: 'SYNTHESIS App'
    });
    
    const runnerUrl = isDev ? 'http://localhost:9002/synthesis-runner' : `file://${path.join(__dirname, 'out', 'synthesis-runner.html')}`;
    synthesisWindow.loadURL(runnerUrl);
  });
}

app.whenReady().then(() => {
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
