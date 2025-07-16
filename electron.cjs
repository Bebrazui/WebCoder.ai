
// electron.cjs
const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
  // Создаем окно браузера.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Загружаем ваше Next.js приложение.
  // В режиме разработки мы используем URL сервера разработки.
  // В продакшене мы бы загружали статический HTML-файл.
  const startUrl = isDev
    ? 'http://localhost:9002' // Убедитесь, что порт совпадает с портом в package.json
    : `file://${path.join(__dirname, '../out/index.html')}`;
  
  win.loadURL(startUrl);

  // Открываем DevTools, если в режиме разработки.
  if (isDev) {
    win.webContents.openDevTools();
  }
}

// Этот метод будет вызываться, когда Electron закончит
// инициализацию и будет готов к созданию окон браузера.
app.whenReady().then(createWindow);

// Выход из приложения, когда все окна закрыты (кроме macOS).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // На macOS обычно создают новое окно в приложении, когда
  // иконка в доке нажата, и нет других открытых окон.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
