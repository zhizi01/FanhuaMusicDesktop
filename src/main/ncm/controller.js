'use strict';

const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { CdpClient, getVersion, listTargets } = require('./cdp');
const proc = require('./process');
const { pageBridge } = require('./page-bridge');

// Hash of the bridge source: any code change replaces the copy already living in the NCM page.
const BRIDGE_VERSION = crypto.createHash('sha1').update(pageBridge.toString()).digest('hex').slice(0, 12);
const BINDING = '__musicDesktopEmit';
const APP_PAGE = 'orpheus://orpheus/pub/app.html';
const COMMANDS = new Set(['play', 'pause', 'toggle', 'next', 'prev', 'like', 'unlike', 'toggleLike', 'seek']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const initialPlayerState = () => ({
  track: null,
  playing: false,
  playingState: 0,
  playingMode: '',
  liked: false,
  volume: null,
  progress: { position: 0, playId: '', at: 0 },
  lyric: { trackId: '', status: 'none', source: '', lines: [] },
});

/**
 * Connection status values:
 *   idle | launching | restarting | connecting | connected | disconnected | waiting | need-restart | error
 *
 * Events: 'state' (full snapshot), 'progress' ({position, playId, at, playing}), 'log' ({level, message})
 */
class NcmController extends EventEmitter {
  constructor(options = {}) {
    super();
    this.opts = {
      port: 9222,
      exePath: null,
      autoLaunch: true, // start NCM (with the debug flag) if it is not running when the controller starts
      relaunchOnExit: false, // also relaunch it after the user quits NCM
      autoRestart: true, // kill + relaunch an NCM instance that runs without the debug flag
      pollInterval: 2000,
      restartCooldown: 30000,
      ...options,
    };
    this.client = null;
    this.running = false;
    this.exePath = null;
    this.lastLaunchAt = 0;
    this.everConnected = false;
    this.manualReconnect = false;
    this.wake = null;
    this.injectTimer = null;
    this.clientId = crypto.randomUUID();
    this.state = { connection: { status: 'idle', message: '' }, ...initialPlayerState() };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.#loop();
  }

  /** Drops the current connection and reconnects now; launches NCM if needed, even after the user quit it. */
  reconnect() {
    this.manualReconnect = true;
    this.lastLaunchAt = 0;
    this.#setConnection('connecting', '正在重新连接网易云音乐...');
    if (this.client) this.client.close();
    if (this.wake) this.wake();
  }

  /** Releases the page bridge (removed once no controller uses it) and disconnects. */
  async stop() {
    this.running = false;
    clearTimeout(this.injectTimer);
    if (this.wake) this.wake();
    const client = this.client;
    if (!client) return;
    const release = `window.__musicDesktop && window.__musicDesktop.release(${JSON.stringify(this.clientId)})`;
    await client.evaluate(release, { timeoutMs: 1000 }).catch(() => {});
    client.close();
  }

  getState() {
    return this.state;
  }

  async command(name, arg) {
    if (!COMMANDS.has(name)) throw new Error(`Unknown command: ${name}`);
    if (!this.client || this.state.connection.status !== 'connected') throw new Error('网易云音乐未连接');
    const expr = `window.__musicDesktop.exec(${JSON.stringify(name)}, ${JSON.stringify(arg ?? null)})`;
    const res = await this.client.evaluate(expr, { timeoutMs: 15000 });
    if (res && res.player) this.#applyPlayer(res.player);
    return res;
  }

  // ---------- supervision ----------

  async #loop() {
    while (this.running) {
      try {
        const client = await this.#tryConnect();
        if (client) {
          await new Promise((resolve) => (client.closed ? resolve() : client.once('close', resolve)));
          this.#onDisconnected();
          continue;
        }
      } catch (err) {
        if (this.client) this.client.close();
        this.client = null;
        this.#setConnection('error', err.message);
      }
      await this.#sleep(this.opts.pollInterval);
    }
  }

  /** Poll delay that reconnect()/stop() can cut short. */
  #sleep(ms) {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.wake = done;
    });
  }

  async #tryConnect() {
    const { port } = this.opts;
    const version = await getVersion(port);
    if (version) {
      if (!/NeteaseMusicDesktop/i.test(version['User-Agent'] || '')) {
        this.#setConnection('error', `调试端口 ${port} 被其他程序占用（${version.Browser || 'unknown'}），请通过 NCM_DEBUG_PORT 更换端口`);
        return null;
      }
      return this.#connect();
    }

    if (await proc.isRunning()) {
      if (Date.now() - this.lastLaunchAt < this.opts.restartCooldown) {
        this.#setConnection('launching', '等待网易云音乐开启调试端口...');
        return null;
      }
      const processes = await proc.listProcesses();
      const flag = `--remote-debugging-port=${port}`;
      if (processes.some((p) => p.isMain && p.cmd.includes(flag))) {
        this.#setConnection('launching', '网易云音乐正在初始化...');
        return null;
      }
      if (!this.opts.autoRestart) {
        this.#setConnection('need-restart', '网易云音乐未开启调试端口，需要重启');
        return null;
      }
      const exe = await this.#resolveExe(processes);
      if (!exe) return this.#launch(null); // reports the error without killing the user's NCM
      this.#setConnection('restarting', '正在以调试模式重启网易云音乐...');
      this.#log('warn', `cloudmusic.exe running without ${flag}; restarting`);
      await proc.killAll();
      await sleep(1000);
      return this.#launch(exe);
    }

    const mayLaunch = this.manualReconnect || (this.opts.autoLaunch && (!this.everConnected || this.opts.relaunchOnExit));
    if (!mayLaunch) {
      this.#setConnection('waiting', this.everConnected ? '网易云音乐已退出，点击“重新连接”或手动打开后将自动连接' : '等待网易云音乐启动');
      return null;
    }
    if (Date.now() - this.lastLaunchAt < this.opts.restartCooldown) {
      this.#setConnection('launching', '等待网易云音乐启动...');
      return null;
    }
    return this.#launch(await this.#resolveExe());
  }

  #launch(exe) {
    if (!exe) {
      this.#setConnection('error', '未找到 cloudmusic.exe，请通过环境变量 NCM_PATH 指定路径');
      return null;
    }
    this.#setConnection('launching', '正在启动网易云音乐...');
    this.#log('info', `launching ${exe} --remote-debugging-port=${this.opts.port}`);
    proc.launch(exe, this.opts.port);
    this.lastLaunchAt = Date.now();
    this.manualReconnect = false;
    return null;
  }

  async #resolveExe(processes) {
    if (!this.exePath || !fs.existsSync(this.exePath)) {
      this.exePath = await proc.findExePath(this.opts.exePath, processes || (await proc.listProcesses()));
    }
    return this.exePath;
  }

  async #connect() {
    const targets = await listTargets(this.opts.port);
    const target = targets.find((t) => t.type === 'page' && t.url.startsWith(APP_PAGE));
    if (!target) {
      this.#setConnection('connecting', '等待网易云音乐主界面加载...');
      return null;
    }
    this.#setConnection('connecting', '正在连接网易云音乐...');
    const client = await CdpClient.connect(target.webSocketDebuggerUrl);
    client.on('error', (err) => this.#log('warn', `CDP socket error: ${err.message}`));
    client.on('Runtime.bindingCalled', (p) => p.name === BINDING && this.#onBridgeMessage(p.payload));
    this.client = client;
    await client.send('Runtime.addBinding', { name: BINDING });
    await client.send('Runtime.enable');
    // Attached after Runtime.enable so the replayed events for already-existing contexts are ignored.
    client.on('Runtime.executionContextCreated', ({ context }) => {
      // Page target id == main frame id; re-inject when the NCM main page reloads.
      if (!context.auxData || !context.auxData.isDefault || context.auxData.frameId !== target.id) return;
      this.#setConnection('connecting', '网易云音乐页面已重新加载，正在重新注入...');
      this.#scheduleInject(1000);
    });
    this.#setConnection('connecting', '等待网易云播放器就绪...');
    await this.#inject();
    return client;
  }

  #scheduleInject(delay) {
    clearTimeout(this.injectTimer);
    this.injectTimer = setTimeout(() => this.#inject().catch((err) => this.#log('warn', `inject failed: ${err.message}`)), delay);
  }

  async #inject() {
    if (!this.client || this.client.closed) return;
    const result = await this.client.evaluate(`(${pageBridge.toString()})(${JSON.stringify(BINDING)}, ${JSON.stringify(BRIDGE_VERSION)}, ${JSON.stringify(this.clientId)})`, {
      awaitPromise: false,
    });
    this.#log('info', `bridge ${result}`);
  }

  #onDisconnected() {
    this.client = null;
    clearTimeout(this.injectTimer);
    Object.assign(this.state, initialPlayerState());
    if (this.manualReconnect) this.#setConnection('connecting', '正在重新连接网易云音乐...');
    else this.#setConnection('disconnected', '与网易云音乐的连接已断开');
  }

  // ---------- bridge messages ----------

  #onBridgeMessage(payload) {
    let msg;
    try {
      msg = JSON.parse(payload);
    } catch {
      return;
    }
    const { type, data } = msg;
    if (type === 'ready') {
      this.everConnected = true;
      this.manualReconnect = false;
      this.#setConnection('connected', '已连接网易云音乐');
    } else if (type === 'player') {
      this.#applyPlayer(data);
    } else if (type === 'progress') {
      this.state.progress = { position: data.position, playId: data.playId, at: Date.now() };
      this.state.playing = data.playing;
      this.emit('progress', { ...this.state.progress, playing: data.playing });
    } else if (type === 'lyric') {
      this.state.lyric = data;
      this.#emitState();
    } else if (type === 'warn') {
      this.#log('warn', `[bridge] ${data}`);
    }
  }

  #applyPlayer(p) {
    const { track, playing, playingState, playingMode, liked, volume } = p;
    Object.assign(this.state, { track, playing, playingState, playingMode, liked, volume });
    this.#emitState();
  }

  #setConnection(status, message) {
    const c = this.state.connection;
    if (c.status === status && c.message === message) return;
    this.state.connection = { status, message };
    this.#log('info', `[${status}] ${message}`);
    this.#emitState();
  }

  #emitState() {
    this.emit('state', this.state);
  }

  #log(level, message) {
    this.emit('log', { level, message });
  }
}

module.exports = { NcmController, COMMANDS };
