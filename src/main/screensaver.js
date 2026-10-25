'use strict';

const { EventEmitter } = require('node:events');

const MAX_FAILURES = 5;
const LOCKOUT_MS = 30000;

/**
 * Owns the screensaver state in the main process so that reloading the renderer cannot bypass the lock.
 * Note: this is an application-level lock; it cannot block OS shortcuts such as Ctrl+Alt+Del or Win+L.
 */
class ScreenSaver extends EventEmitter {
  constructor({ settings, restoreAspectRatio }) {
    super();
    this.settings = settings;
    this.restoreAspectRatio = restoreAspectRatio;
    this.win = null;
    this.active = false;
    this.locked = false;
    this.savedBounds = null;
    this.failures = 0;
    this.blockedUntil = 0;
  }

  attach(win) {
    this.win = win;
    // Alt+F4 / taskbar close must not end a locked screensaver.
    win.on('close', (e) => this.locked && e.preventDefault());
  }

  getState() {
    return { active: this.active, locked: this.locked };
  }

  enter() {
    const win = this.win;
    if (!win || this.active) return this.getState();
    this.savedBounds = win.getBounds();
    this.active = true;
    this.locked = this.settings.isLockEnabled();
    win.setAspectRatio(0);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setKiosk(true);
    win.show();
    win.focus();
    this.#emit();
    return this.getState();
  }

  exit(password) {
    if (!this.active) return { ok: true };
    if (this.locked) {
      const now = Date.now();
      if (now < this.blockedUntil) {
        return { ok: false, message: `尝试次数过多，请 ${Math.ceil((this.blockedUntil - now) / 1000)} 秒后再试` };
      }
      if (!this.settings.verifyPassword(password)) {
        this.failures += 1;
        if (this.failures >= MAX_FAILURES) {
          this.failures = 0;
          this.blockedUntil = now + LOCKOUT_MS;
          return { ok: false, message: `密码错误次数过多，请 ${LOCKOUT_MS / 1000} 秒后再试` };
        }
        return { ok: false, message: `密码错误（还可尝试 ${MAX_FAILURES - this.failures} 次）` };
      }
    }
    this.failures = 0;
    this.active = false;
    this.locked = false;
    const win = this.win;
    win.setKiosk(false);
    win.setAlwaysOnTop(false);
    if (this.savedBounds) win.setBounds(this.savedBounds);
    this.restoreAspectRatio();
    this.#emit();
    return { ok: true };
  }

  #emit() {
    this.emit('change', this.getState());
  }
}

module.exports = { ScreenSaver };
