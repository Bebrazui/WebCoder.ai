// main.js
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const createMenuTemplate = require('./menu.js');

const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    // Эти опции включают кастомную рамку
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Эти опции важны для безопасности, но для разработки
      // и интеграции с Next.js мы их настраиваем так:
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Загружаем URL в зависимости от режима (разработка или продакшн)
  const startUrl = isDev ? 'http://localhost:9002' : `file://${path.join(__dirname, 'out/index.html')}`;
  mainWindow.loadURL(startUrl);

  // Открываем DevTools в режиме разработки
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // --- IPC Handlers for window controls ---
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
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:isMaximized', true);
  });
  
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:isMaximized', false);
  });
  
  // --- Application Menu ---
  const menuTemplate = createMenuTemplate(app, mainWindow);
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

}

app.whenReady().then(() => {
  createWindow();

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
