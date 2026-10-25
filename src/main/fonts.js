'use strict';

const { execFile } = require('node:child_process');

// Symbol / icon fonts are useless as UI fonts.
const EXCLUDED = /^(Marlett|Symbol|Webdings|Wingdings.*|MT Extra|Segoe (MDL2 Assets|Fluent Icons|UI Emoji|UI Symbol|UI Historic))$/i;
// GDI truncates family names to 31 characters; truncated names don't resolve in CSS.
const MAX_NAME = 30;

const SCRIPT =
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; ' +
  'ConvertTo-Json -Compress -InputObject @((New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name })';

let cache = null;

/** Installed font family names (localized, e.g. "微软雅黑"), sorted with CJK fonts first. Cached after the first call. */
function listFonts() {
  cache ??= new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT], { windowsHide: true, timeout: 20000 }, (err, out) => {
      let names = [];
      try {
        names = err ? [] : JSON.parse(out);
      } catch {
        names = [];
      }
      const isCjk = (n) => /[\u3400-\u9fff]/.test(n);
      const unique = [...new Set(names.filter((n) => typeof n === 'string' && n.length <= MAX_NAME && !EXCLUDED.test(n)))];
      unique.sort((a, b) => Number(isCjk(b)) - Number(isCjk(a)) || a.localeCompare(b, 'zh-CN'));
      if (!unique.length) cache = null; // allow a retry next time
      resolve(unique);
    });
  });
  return cache;
}

module.exports = { listFonts };
