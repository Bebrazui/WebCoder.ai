
const { createWindowsInstaller } = require('electron-winstaller');
const path = require('path');

console.log('Creating Windows installer...');

createWindowsInstaller({
  appDirectory: path.join(__dirname, 'dist', 'WebCoder.ai-win32-x64'),
  outputDirectory: path.join(__dirname, 'dist', 'installer'),
  authors: 'WebCoder.ai Developer',
  exe: 'WebCoder.ai.exe',
  setupExe: 'WebCoder-ai-Installer.exe',
  setupIcon: path.join(__dirname, 'public', 'logo.ico'),
  noMsi: true
})
.then(() => {
  console.log('Installer created successfully!');
})
.catch(error => {
  console.error('Installer creation failed:', error.message || error);
  process.exit(1);
});
