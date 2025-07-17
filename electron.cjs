// electron.cjs
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const createMenuTemplate = require('./menu.js');

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── main.js
// │ │
// │ ├─┬ out
// │ │ ├── ...
// │ │
// │ └── package.json
//
process.env.DIST = path.join(__dirname, 'dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

// Squelch security warnings
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Отключаем стандартную рамку
    titleBarStyle: 'hidden', // Скрываем title bar, но оставляем кнопки на macOS
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    backgroundColor: '#00000000', // Прозрачный фон для скругленных углов
    vibrancy: 'under-window', // Эффект размытия под окном на macOS
  });

  // Установка меню приложения
  const menuTemplate = createMenuTemplate(app, mainWindow);
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // IPC listeners for window controls
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
  
  // Send maximization state to renderer
  const sendMaximizedState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:isMaximized', mainWindow.isMaximized());
    }
  }

  mainWindow.on('maximize', sendMaximizedState);
  mainWindow.on('unmaximize', sendMaximizedState);

  // You can use `process.env.VITE_DEV_SERVER_URL` when Can be accessed in the development environment
  const devServerUrl = 'http://localhost:9002'; // Next.js dev server

  if (app.isPackaged) {
    // If the app is packaged, load the local Next.js build
    const indexHtml = path.join(__dirname, 'out', 'index.html');
    mainWindow.loadFile(indexHtml);
  } else {
    // In development, load the Next.js dev server URL
    mainWindow.loadURL(devServerUrl);
    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
