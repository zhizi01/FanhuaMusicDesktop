// Usage: node tools/cdp-eval.mjs "<js expression>"   or   node tools/cdp-eval.mjs -f script.js
import { readFileSync } from 'node:fs';

const port = process.env.NCM_DEBUG_PORT || 9222;
const args = process.argv.slice(2);
const expression = args[0] === '-f' ? readFileSync(args[1], 'utf8') : args.join(' ');

const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find((p) => p.type === 'page' && p.url.startsWith('orpheus://orpheus/pub/app.html')) || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id !== 1) return;
  const r = msg.result;
  if (r.exceptionDetails) console.error('EXCEPTION:', JSON.stringify(r.exceptionDetails, null, 2));
  else console.log(typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value ?? r.result, null, 2));
  ws.close();
};
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
