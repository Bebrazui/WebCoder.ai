// electron.cjs
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const createMenuTemplate = require('./menu.js');

const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: false, // Скрываем стандартную рамку
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#1e293b' // Цвет фона для темной темы
  });

  if (isDev) {
    // В режиме разработки загружаем URL сервера Next.js
    mainWindow.loadURL('http://localhost:9002');
  } else {
    // В продакшене загружаем собранные файлы
    mainWindow.loadFile(path.join(__dirname, 'out', 'index.html'));
  }

  // Установка меню приложения
  const menu = Menu.buildFromTemplate(createMenuTemplate(app, mainWindow));
  Menu.setApplicationMenu(menu);

  // Обработчики для управления окном из рендерер-процесса
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

  // Отправляем состояние окна в рендерер при изменении
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:isMaximized', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:isMaximized', false);
  });
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