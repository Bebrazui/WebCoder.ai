// electron.cjs

const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');
const isDev = require('electron-is-dev');
const customMenu = require('./menu'); // Импортируем наше кастомное меню

function createWindow() {
  // Создаем окно браузера.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Важно для безопасности, но может потребовать настройки для взаимодействия с Node.js
      // contextIsolation: true,
      // nodeIntegration: false,
    },
  });

  // Устанавливаем кастомное меню
  const menu = Menu.buildFromTemplate(customMenu(app, win));
  Menu.setApplicationMenu(menu);


  // Загружаем index.html в режиме продакшена или URL разработки.
  const startUrl = isDev
    ? 'http://localhost:9002' // URL вашего сервера разработки Next.js
    : `file://${path.join(__dirname, '../out/index.html')}`; // Путь к собранному приложению

  win.loadURL(startUrl);

  // Открываем DevTools, если в режиме разработки.
  if (isDev) {
    win.webContents.openDevTools();
  }
}

// Этот метод будет вызван, когда Electron закончит
// инициализацию и будет готов к созданию окон.
app.whenReady().then(createWindow);

// Выход, когда все окна закрыты, кроме macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // На macOS обычно создают новое окно в приложении,
  // когда значок в доке нажат, и нет других открытых окон.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
