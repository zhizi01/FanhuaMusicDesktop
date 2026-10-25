// Dev mode: Vite dev server (HMR for the Vue renderer) + Electron pointed at it.
// Main/preload changes still need a restart of this script.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const electron = createRequire(import.meta.url)('electron');

const server = await createServer({ configFile: fileURLToPath(new URL('../vite.config.mts', import.meta.url)) });
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`[dev] renderer at ${url}`);

const env = { ...process.env, VITE_DEV_SERVER_URL: url };
delete env.ELECTRON_RUN_AS_NODE; // exported by Electron-based IDE terminals

const child = spawn(electron, ['.', ...process.argv.slice(2)], { cwd: root, env, stdio: 'inherit' });
child.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
