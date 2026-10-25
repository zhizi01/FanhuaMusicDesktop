// Dev helper: inspect the running app's renderer over CDP (start it with `-- --remote-debugging-port=9333`).
//   node tools/ui-probe.mjs eval "<js>"            evaluate in the renderer, print the result
//   node tools/ui-probe.mjs shot out.png           screenshot of the renderer
//   node tools/ui-probe.mjs move <x> <y>           dispatch a real mouse move (e.g. to wake the screensaver panel)
//   node tools/ui-probe.mjs down|up <x> <y>        press / release the left button (drag = down, move..., up)
//   node tools/ui-probe.mjs type "<text>"          type text into the focused element
//   node tools/ui-probe.mjs key <Enter|Escape>     press a key
import { writeFileSync } from 'node:fs';

const port = process.env.APP_DEBUG_PORT || 9333;
const [mode, ...args] = process.argv.slice(2);
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find((p) => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (pending.has(m.id)) pending.get(m.id)(m), pending.delete(m.id);
};
const send = (method, params = {}) => new Promise((r) => (pending.set(++id, r), ws.send(JSON.stringify({ id, method, params }))));
const KEYS = { Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }, Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 } };

if (mode === 'eval') {
  const r = await send('Runtime.evaluate', { expression: args[0], returnByValue: true, awaitPromise: true });
  const res = r.result;
  console.log(res.exceptionDetails ? JSON.stringify(res.exceptionDetails) : typeof res.result.value === 'string' ? res.result.value : JSON.stringify(res.result.value, null, 1));
} else if (mode === 'shot') {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(args[0], Buffer.from(r.result.data, 'base64'));
  console.log(`saved ${args[0]}`);
} else if (mode === 'move') {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Number(args[0]), y: Number(args[1]), buttons: Number(process.env.BUTTONS || 0) });
  console.log('moved');
} else if (mode === 'down' || mode === 'up') {
  const type = mode === 'down' ? 'mousePressed' : 'mouseReleased';
  await send('Input.dispatchMouseEvent', { type, x: Number(args[0]), y: Number(args[1]), button: 'left', buttons: mode === 'down' ? 1 : 0, clickCount: 1 });
  console.log(mode);
} else if (mode === 'type') {
  await send('Input.insertText', { text: args[0] });
  console.log('typed');
} else if (mode === 'key') {
  const k = KEYS[args[0]];
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k, text: undefined });
  console.log('key', args[0]);
}
ws.close();
