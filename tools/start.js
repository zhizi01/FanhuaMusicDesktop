'use strict';

// Launches Electron with ELECTRON_RUN_AS_NODE removed: terminals hosted by Electron-based IDEs
// (VS Code, Windsurf, ...) export it, which would make Electron run as plain Node.
const { spawn } = require('node:child_process');
const path = require('node:path');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, ['.', ...process.argv.slice(2)], { cwd: path.join(__dirname, '..'), env, stdio: 'inherit' });
child.on('close', (code) => process.exit(code ?? 0));
