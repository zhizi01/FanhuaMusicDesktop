'use strict';

const { EventEmitter } = require('node:events');
const WebSocket = require('ws');

async function httpJson(port, path, timeoutMs = 1500) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

/** Returns the DevTools /json/version payload, or null if nothing is listening on the port. */
async function getVersion(port) {
  try {
    return await httpJson(port, '/json/version');
  } catch {
    return null;
  }
}

const listTargets = (port) => httpJson(port, '/json/list');

class CdpClient extends EventEmitter {
  constructor(ws) {
    super();
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
    ws.on('message', (raw) => this.#onMessage(raw));
    ws.on('close', () => this.#onClose());
    ws.on('error', (err) => this.emit('error', err));
  }

  static connect(wsUrl, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { perMessageDeflate: false, handshakeTimeout: timeoutMs });
      ws.once('open', () => resolve(new CdpClient(ws)));
      ws.once('error', reject);
    });
  }

  send(method, params = {}, timeoutMs = 10000) {
    if (this.closed) return Promise.reject(new Error('CDP connection closed'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Runtime.evaluate with by-value result; throws on JS exceptions. */
  async evaluate(expression, { awaitPromise = true, timeoutMs = 10000 } = {}) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }, timeoutMs);
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error((d.exception && d.exception.description) || d.text || 'Evaluation failed');
    }
    return res.result.value;
  }

  close() {
    if (!this.closed) this.ws.close();
  }

  #onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.id !== undefined) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(`CDP ${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
    } else if (msg.method) {
      this.emit(msg.method, msg.params);
    }
  }

  #onClose() {
    this.closed = true;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('CDP connection closed'));
    }
    this.pending.clear();
    this.emit('close');
  }
}

module.exports = { CdpClient, getVersion, listTargets };
