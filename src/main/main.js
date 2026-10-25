'use strict';

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const { NcmController } = require('./ncm/controller');
const { SettingsStore } = require('./settings');
const { ScreenSaver } = require('./screensaver');

// Optional separate profile (settings + single-instance lock), e.g. for testing without touching real settings.
if (process.env.MUSIC_DESKTOP_USER_DATA) app.setPath('userData', process.env.MUSIC_DESKTOP_USER_DATA);

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

const APP_NAME = '繁花GG';
const ASPECT_RATIO = 9 / 16;
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

const controller = new NcmController({
  port: Number(process.env.NCM_DEBUG_PORT) || 9222,
  exePath: process.env.NCM_PATH || null,
});
controller.on('log', ({ level, message }) => console[level === 'info' ? 'log' : level](`[ncm] ${message}`));

let win = null;
let settings = null;
let screensaver = null;
let frameExtra = { width: 0, height: 0 };

/**
 * Keeps the visible content at exactly 9:16. On Windows the native aspect-ratio constraint is applied to the
 * OS window rect, which for frameless windows includes invisible resize borders (`extraSize` is ignored), so
 * the ratio handed to Electron is derived from the current content height. Re-run after every resize.
 */
function applyAspectRatio() {
  if (!win || win.isDestroyed() || (screensaver && screensaver.active)) return;
  const [, height] = win.getContentSize();
  win.setAspectRatio((height * ASPECT_RATIO + frameExtra.width) / (height + frameExtra.height));
}

/** Measures the invisible borders once the page is up, then sizes the content to 450x800. */
async function fitWindowShape() {
  const [dw, dh] = await win.webContents.executeJavaScript('[outerWidth - innerWidth, outerHeight - innerHeight]');
  frameExtra = { width: Math.max(0, dw), height: Math.max(0, dh) };
  win.setSize(450, 800);
  applyAspectRatio();
}

function createWindow() {
  win = new BrowserWindow({
    width: 450,
    height: 800,
    minWidth: 360,
    minHeight: 640,
    frame: false,
    maximizable: false,
    show: false,
    title: APP_NAME,
    backgroundColor: '#0e0e13',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  applyAspectRatio();
  win.on('resized', applyAspectRatio);
  screensaver.attach(win);
  win.once('ready-to-show', () => {
    win.show();
    fitWindowShape().catch((err) => console.warn('[window] fitWindowShape failed:', err.message));
  });
  win.webContents.on('render-process-gone', () => win && !win.isDestroyed() && win.reload());
  win.on('closed', () => (win = null));

  if (DEV_SERVER_URL) win.loadURL(DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
}

const send = (channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};

/** Wraps an IPC handler so thrown errors become { ok: false, message } results. */
const safe = (fn) => async (_event, ...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    return { ok: false, message: err.message };
  }
};

function registerIpc() {
  ipcMain.handle('ncm:get-state', () => controller.getState());
  ipcMain.handle('ncm:command', safe((name, arg) => controller.command(name, arg)));
  ipcMain.handle('ncm:reconnect', () => {
    controller.reconnect();
    return { ok: true };
  });

  ipcMain.handle('settings:get', () => settings.getPublic());
  ipcMain.handle('settings:update', safe((patch) => ({ ok: true, settings: settings.update(patch) })));
  ipcMain.handle('settings:set-password', safe((password) => ({ ok: true, settings: settings.setPassword(password) })));
  ipcMain.handle('settings:clear-password', safe(() => ({ ok: true, settings: settings.clearPassword() })));

  ipcMain.handle('screensaver:get-state', () => screensaver.getState());
  ipcMain.handle('screensaver:enter', () => screensaver.enter());
  ipcMain.handle('screensaver:exit', safe((password) => screensaver.exit(password)));

  ipcMain.handle('window:minimize', () => win && win.minimize());
  ipcMain.handle('window:close', () => win && win.close());

  controller.on('state', (state) => send('ncm:state', state));
  controller.on('progress', (progress) => send('ncm:progress', progress));
  screensaver.on('change', (state) => send('screensaver:state', state));
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  // No menu: drops the reload / devtools accelerators in production (kept in dev for debugging).
  if (!DEV_SERVER_URL) Menu.setApplicationMenu(null);
  settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  screensaver = new ScreenSaver({ settings, restoreAspectRatio: applyAspectRatio });
  registerIpc();
  createWindow();
  controller.start();
});

app.on('window-all-closed', () => {
  controller.stop().finally(() => app.quit());
});
