// electron.cjs
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const createMenuTemplate = require('./menu');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;
// Keep a reference to the current child process
let childProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    // The following options are for a frameless window with custom title bar
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#232F34', // Match your dark theme background
  });

  const startUrl = isDev
    ? 'http://localhost:9002' // Port from package.json
    : `file://${path.join(__dirname, 'out/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Set up the application menu
  const menu = Menu.buildFromTemplate(createMenuTemplate(app, mainWindow));
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => (mainWindow = null));

  // Listen for window control events from the renderer
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow.close());

  // Send maximization state to renderer
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:isMaximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:isMaximized', false));
}

// --- IPC for Terminal Command Execution ---
ipcMain.on('execute-command', (event, { command, args, cwd }) => {
  // If another process is running, kill it first
  if (childProcess) {
    childProcess.kill();
    childProcess = null;
  }
  
  // Use shell: true to handle complex commands like those with pipes or redirects,
  // and to ensure system PATH is respected.
  childProcess = spawn(command, args, { cwd, shell: true });

  childProcess.stdout.on('data', (data) => {
    event.sender.send('terminal-output', data.toString());
  });

  childProcess.stderr.on('data', (data) => {
    // Send stderr data to the same output channel for simplicity, xterm can color it.
    event.sender.send('terminal-output', data.toString());
  });

  childProcess.on('close', (code) => {
    event.sender.send('terminal-command-complete', code);
    childProcess = null; // Clear the process reference
  });

  childProcess.on('error', (err) => {
    event.sender.send('terminal-output', `\r\nFailed to start command: ${err.message}\r\n`);
    event.sender.send('terminal-command-complete', 1);
    childProcess = null; // Clear the process reference
  });
});

ipcMain.on('terminal-input', (event, data) => {
    if (childProcess) {
        childProcess.stdin.write(data);
    }
});

// Handle Ctrl+C from terminal
ipcMain.on('terminal-kill', () => {
  if (childProcess) {
    childProcess.kill('SIGINT'); // Send SIGINT for graceful shutdown
    childProcess = null;
  }
});


app.on('ready', () => {
  createWindow();

  // Handle opening files with the app on macOS
  app.on('open-file', (event, path) => {
    event.preventDefault();
    mainWindow.webContents.send('open-path', path);
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// This will be triggered by file associations on Windows/Linux
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // The last argument is the file/folder path
  const openPath = commandLine.pop();
  if (openPath && mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send('open-path', openPath);
  }
});

// On Windows, the path is in process.argv
if (process.platform === 'win32' && process.argv.length >= 2) {
    const openPath = process.argv[1];
    // A simple check to see if it's a path and not a flag
    if (openPath && !openPath.startsWith('--')) {
        app.on('ready', () => {
            mainWindow.webContents.send('open-path', openPath);
        });
    }
}
