'use strict';

// Renders build/icon.svg with Electron's offscreen renderer and writes:
//   build/icon.png  (1024x1024)   build/icon.ico  (16-256, PNG-compressed entries)
// Usage: node tools/start.js tools/make-icons.js   (or: npm run icons)
// Set ICON_PREVIEW=<file.png> to also write a preview sheet (sizes on dark/light backgrounds).
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const CANVAS = 1024;

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration();

const sized = (size) => svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
const page = (body, bg = 'transparent') =>
  `data:text/html;charset=utf-8,${encodeURIComponent(`<html><body style="margin:0;background:${bg};overflow:hidden">${body}</body></html>`)}`;

async function capture(win, url, width, height) {
  await win.loadURL(url);
  await new Promise((r) => setTimeout(r, 200));
  return win.webContents.capturePage({ x: 0, y: 0, width, height });
}

/** ICO container with PNG payloads (supported by Windows Vista+ and electron-builder/rcedit). */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt16LE(1, o + 4); // planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: CANVAS,
    height: CANVAS,
    show: false,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true },
  });

  const big = await capture(win, page(sized(CANVAS)), CANVAS, CANVAS);
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), big.toPNG());

  const entries = [];
  for (const size of ICO_SIZES) {
    const img = await capture(win, page(sized(size)), size, size);
    const actual = img.getSize();
    if (actual.width !== size) throw new Error(`rendered ${actual.width}px instead of ${size}px`);
    entries.push({ size, png: img.toPNG() });
  }
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), buildIco(entries));
  console.log(`wrote build/icon.png (${CANVAS}px) and build/icon.ico (${ICO_SIZES.join(', ')})`);

  if (process.env.ICON_PREVIEW) {
    const row = (bg) =>
      `<div style="display:flex;align-items:center;gap:24px;padding:24px;background:${bg}">${[256, 128, 64, 48, 32, 24, 16].map(sized).join('')}</div>`;
    const sheet = await capture(win, page(row('#1e1e1e') + row('#f3f3f3')), 760, 608);
    fs.writeFileSync(process.env.ICON_PREVIEW, sheet.toPNG());
    console.log(`preview: ${process.env.ICON_PREVIEW}`);
  }
  app.quit();
});
