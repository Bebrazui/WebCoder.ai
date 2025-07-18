// electron.cjs
const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const createMenuTemplate = require('./menu.js');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let activeChildProcess;

const isDev = !app.isPackaged;
const appUrl = isDev ? 'http://localhost:9002' : `file://${path.join(__dirname, 'out', 'index.html')}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#00000000'
  });

  mainWindow.loadURL(appUrl);
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // --- Window State ---
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:isMaximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:isMaximized', false));

  // --- Menu ---
  const menuTemplate = createMenuTemplate(app, mainWindow);
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (activeChildProcess) {
      activeChildProcess.kill();
    }
  });

  // --- Check for updates ---
  mainWindow.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
}

// --- IPC Handlers ---
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow.close());

ipcMain.on('execute-command', (event, { command, args, cwd }) => {
  if (activeChildProcess) {
    event.reply('terminal-output', '\r\nAnother process is already running.\r\n');
    return;
  }
  
  try {
    const effectiveCwd = cwd || (app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd());
    activeChildProcess = spawn(command, args, { cwd: effectiveCwd, shell: true });

    activeChildProcess.stdout.on('data', (data) => {
      event.reply('terminal-output', data.toString());
    });

    activeChildProcess.stderr.on('data', (data) => {
      event.reply('terminal-output', data.toString());
    });
    
    activeChildProcess.on('close', (code) => {
      event.reply('terminal-command-complete', code);
      activeChildProcess = null;
    });

    activeChildProcess.on('error', (err) => {
      event.reply('terminal-output', `\r\nError: ${err.message}\r\n`);
      event.reply('terminal-command-complete', 1);
      activeChildProcess = null;
    });

  } catch (err) {
      event.reply('terminal-output', `\r\nSpawn Error: ${err.message}\r\n`);
      event.reply('terminal-command-complete', 1);
      activeChildProcess = null;
  }
});

ipcMain.on('terminal-kill', () => {
    if (activeChildProcess) {
        activeChildProcess.kill();
        activeChildProcess = null;
    }
});

// --- App Lifecycle ---
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

// --- File/Folder Opening Logic ---
let openPathQueue = [];
if (process.platform === 'win32' && process.argv.length >= 2) {
  const openPath = process.argv[1];
  if (openPath && openPath !== '.') {
    openPathQueue.push(openPath);
  }
}

app.on('will-finish-launching', () => {
  app.on('open-file', (event, path) => {
    event.preventDefault();
    if (mainWindow) {
      mainWindow.webContents.send('open-path', path);
    } else {
      openPathQueue.push(path);
    }
  });
  app.on('open-url', (event, url) => {
     event.preventDefault();
     const path = url.replace('webcoder://', '');
     if (mainWindow) {
        mainWindow.webContents.send('open-path', path);
     } else {
        openPathQueue.push(path);
     }
  });
});

// --- Auto-Updater Events ---
autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Найдено обновление',
    message: 'Доступна новая версия. Хотите загрузить и установить её сейчас?',
    buttons: ['Да', 'Позже']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Обновление готово',
    message: 'Новая версия загружена. Перезапустить приложение, чтобы применить обновления?',
    buttons: ['Перезапустить', 'Позже']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (error) => {
  dialog.showErrorBox('Ошибка обновления', error == null ? "Неизвестная ошибка" : (error.stack || error).toString());
});
