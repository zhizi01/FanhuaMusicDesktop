'use strict';

const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const EXE_NAME = 'cloudmusic.exe';
const DEFAULT_PATHS = [
  'C:\\Program Files\\NetEase\\CloudMusic\\cloudmusic.exe',
  'C:\\Program Files (x86)\\NetEase\\CloudMusic\\cloudmusic.exe',
];
const REGISTRY_KEYS = [
  'HKCU:\\Software\\Netease\\CloudMusic',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Netease\\CloudMusic',
  'HKLM:\\SOFTWARE\\Netease\\CloudMusic',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(file, args, timeout = 10000) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => resolve(err ? null : stdout));
  });
}

async function powershellJson(script) {
  const out = await run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${script}`,
  ]);
  if (!out || !out.trim()) return null;
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/** Fast check via tasklist. */
async function isRunning() {
  const out = await run('tasklist', ['/FI', `IMAGENAME eq ${EXE_NAME}`, '/FO', 'CSV', '/NH']);
  return !!out && out.toLowerCase().includes(`"${EXE_NAME}"`);
}

/** Full process info (pid, exe path, command line). Slower: spawns PowerShell. */
async function listProcesses() {
  const list = await powershellJson(
    `ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process -Filter "Name='${EXE_NAME}'" | Select-Object ProcessId,ExecutablePath,CommandLine)`
  );
  return (list || []).map((p) => ({
    pid: p.ProcessId,
    exe: p.ExecutablePath || '',
    cmd: p.CommandLine || '',
    isMain: !/--type=/.test(p.CommandLine || ''),
  }));
}

async function registryInstallDirs() {
  const keys = REGISTRY_KEYS.map((k) => `'${k}'`).join(',');
  const dirs = await powershellJson(
    `ConvertTo-Json -Compress -InputObject @(Get-ItemProperty -Path ${keys} -ErrorAction SilentlyContinue | ForEach-Object { $_.install_dir } | Where-Object { $_ })`
  );
  return dirs || [];
}

/** Resolve cloudmusic.exe: explicit path > running process > registry > default install paths. */
async function findExePath(preferred, runningProcesses) {
  const exists = (p) => !!p && fs.existsSync(p);
  if (exists(preferred)) return preferred;
  const fromProcess = (runningProcesses || []).find((p) => p.isMain && exists(p.exe));
  if (fromProcess) return fromProcess.exe;
  for (const dir of await registryInstallDirs()) {
    const candidate = path.join(dir, EXE_NAME);
    if (exists(candidate)) return candidate;
  }
  return DEFAULT_PATHS.find(exists) || null;
}

/**
 * Started through `cmd /c start` so NCM is not a descendant of this app: tools that end our process tree
 * (task manager "end process tree", IDE terminals, autostart plugins) must not take the user's player down too.
 */
function launch(exePath, debugPort) {
  const flag = `--remote-debugging-port=${debugPort}`;
  const opts = { cwd: path.dirname(exePath), detached: true, stdio: 'ignore', windowsHide: true };
  const child = /["&^%<>|]/.test(exePath)
    ? spawn(exePath, [flag], opts)
    : spawn('cmd.exe', ['/d', '/s', '/c', `"start "" "${exePath}" ${flag}"`], { ...opts, windowsVerbatimArguments: true });
  child.on('error', () => {});
  child.unref();
}

async function killAll(timeoutMs = 8000) {
  await run('taskkill', ['/F', '/IM', EXE_NAME]);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isRunning())) return true;
    await sleep(300);
  }
  return false;
}

module.exports = { EXE_NAME, isRunning, listProcesses, findExePath, launch, killAll };
