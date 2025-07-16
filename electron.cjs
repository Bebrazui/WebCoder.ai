// electron.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Important for security:
      nodeIntegration: false,
      contextIsolation: true,
      // Allow running preload script even with a remote URL in dev
      webSecurity: isDev ? false : true, 
    },
    // icon: path.join(__dirname, 'icons/icon.png') // Future: add an icon
  });

  win.setTitle('WebCoder.ai');

  // Load the app.
  if (isDev) {
    // In development, load from the Next.js dev server.
    // Make sure your Next.js app is running on port 9002.
    win.loadURL('http://localhost:9002');
    // Open the DevTools automatically in development.
    win.webContents.openDevTools();
  } else {
    // In production, load the static HTML file.
    win.loadFile(path.join(__dirname, 'out/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
