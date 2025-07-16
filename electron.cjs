// electron.cjs
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const url = require('url');
const createMenuTemplate = require('./menu.js');

const isDev = process.env.NODE_ENV !== 'production';
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            // Important: contextIsolation is true by default and is a security best practice.
            // preload is the script that will run before the web page is loaded.
            preload: path.join(__dirname, 'preload.js'),
            // Note: nodeIntegration should be kept false and contextIsolation true for security.
            // Use the preload script to expose Node.js APIs to the renderer process.
        }
    });

    const menu = Menu.buildFromTemplate(createMenuTemplate(app, mainWindow));
    Menu.setApplicationMenu(menu);

    let startUrl;

    if (isDev) {
        // In development, load from the Next.js dev server.
        startUrl = 'http://localhost:9002'; 
    } else {
        // In production, load the built HTML file.
        startUrl = url.format({
            pathname: path.join(__dirname, './out/index.html'),
            protocol: 'file:',
            slashes: true
        });
    }

    mainWindow.loadURL(startUrl);

    // Open the DevTools automatically in development.
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS, re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
