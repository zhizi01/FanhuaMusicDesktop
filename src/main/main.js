'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { NcmController } = require('./ncm/controller');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

const controller = new NcmController({
  port: Number(process.env.NCM_DEBUG_PORT) || 9222,
  exePath: process.env.NCM_PATH || null,
});
controller.on('log', ({ level, message }) => console[level === 'info' ? 'log' : level](`[ncm] ${message}`));

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 360,
    minHeight: 560,
    title: 'Music Desktop',
    backgroundColor: '#101014',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.on('closed', () => (win = null));
}

const send = (channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  ipcMain.handle('ncm:get-state', () => controller.getState());
  ipcMain.handle('ncm:command', async (_event, name, arg) => {
    try {
      return await controller.command(name, arg);
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });
  controller.on('state', (state) => send('ncm:state', state));
  controller.on('progress', (progress) => send('ncm:progress', progress));

  createWindow();
  controller.start();
});

app.on('window-all-closed', () => {
  controller.stop().finally(() => app.quit());
});
