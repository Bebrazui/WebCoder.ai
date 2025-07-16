// electron.cjs
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const createMenuTemplate = require('./menu.js');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // Важно для безопасности и современных практик
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    const menu = Menu.buildFromTemplate(createMenuTemplate(app, mainWindow));
    Menu.setApplicationMenu(menu);

    if (isDev) {
        // В режиме разработки загружаем URL Next.js сервера
        mainWindow.loadURL('http://localhost:9002');
        // Открываем DevTools для отладки
        mainWindow.webContents.openDevTools();
    } else {
        // В собранном приложении загружаем статический файл
        mainWindow.loadFile(path.join(__dirname, 'out', 'index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // На macOS, если нет открытых окон, создаем новое при клике на иконку
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Завершаем приложение, когда все окна закрыты (кроме macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});