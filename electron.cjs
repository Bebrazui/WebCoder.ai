
// electron.cjs
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const createMenuTemplate = require('./menu.js');

// URL для разработки и для продакшена
const devUrl = 'http://localhost:9002';
const prodUrl = `file://${path.join(__dirname, 'out', 'index.html')}`;
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Важно для интеграции с Node.js в рендерере, если потребуется
      nodeIntegration: false,
      contextIsolation: true,
    },
    // Добавляем эти опции для кастомной рамки
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 }, // Для macOS
  });

  // Устанавливаем меню приложения
  const menuTemplate = createMenuTemplate(app, mainWindow);
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Загружаем URL
  const urlToLoad = isDev ? devUrl : prodUrl;
  mainWindow.loadURL(urlToLoad);

  // Открываем DevTools, если в режиме разработки
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // --- IPC обработчики для управления окном ---
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

app.whenReady().then(createWindow);

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
