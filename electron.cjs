// electron.cjs
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const createMenuTemplate = require('./menu.js');

// Определяем, является ли окружение разработческим
const isDev = process.env.NODE_ENV !== 'production';
const nextAppDir = path.join(__dirname, 'out');

function createWindow() {
  // Создаем окно браузера.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // важно для безопасности
      contextIsolation: true, // важно для безопасности
    },
    frame: false, // Убираем стандартную рамку окна
    titleBarStyle: 'hidden', // Скрываем заголовок
    backgroundColor: '#00000000', // Прозрачный фон для скругленных углов
    ...(process.platform === 'linux' ? { icon: path.join(__dirname, 'icon.png') } : {}),
  });

  // Загружаем URL в зависимости от окружения
  const url = isDev ? 'http://localhost:9002' : `file://${nextAppDir}/index.html`;

  mainWindow.loadURL(url).catch(err => {
    console.error('Failed to load URL:', url, 'with error:', err.message);
    if (!isDev) {
      // Можно показать диалоговое окно с ошибкой в продакшене
    }
  });

  // Открываем DevTools в режиме разработки
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
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

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:isMaximized', true);
  });
  
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:isMaximized', false);
  });
  
  // Создаем и устанавливаем меню приложения
  const menu = Menu.buildFromTemplate(createMenuTemplate(app, mainWindow));
  Menu.setApplicationMenu(menu);
}

// Этот метод будет вызван, когда Electron завершит инициализацию
// и будет готов к созданию окон.
// Некоторые API могут быть использованы только после этого события.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // На macOS обычно принято заново создавать окно в приложении,
    // когда на иконку в доке кликают и других открытых окон нет.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Выход из приложения, когда все окна закрыты, за исключением macOS.
// На macOS обычно принято, чтобы приложения и их меню продолжали работать,
// даже если все окна закрыты.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
