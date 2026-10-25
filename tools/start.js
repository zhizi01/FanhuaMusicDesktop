'use strict';

// Launches Electron with ELECTRON_RUN_AS_NODE removed: terminals hosted by Electron-based IDEs
// (VS Code, Windsurf, ...) export it, which would make Electron run as plain Node.
const { spawn } = require('node:child_process');
const path = require('node:path');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// `node tools/start.js [script.js] [...electron args]` – runs the app, or another Electron entry script.
const args = process.argv.slice(2);
const entry = args[0] && /\.c?js$/.test(args[0]) ? args.shift() : '.';

const child = spawn(electron, [entry, ...args], { cwd: path.join(__dirname, '..'), env, stdio: 'inherit' });
child.on('close', (code) => process.exit(code ?? 0));
