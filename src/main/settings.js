'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PRESETS = ['lyrics', 'vinyl', 'clock'];
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 64;

const DEFAULTS = {
  screensaver: { preset: 'lyrics', showTranslation: true, lockEnabled: false, password: null },
};

const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 32);

/** Persists settings as JSON in the app's userData folder. The password is only ever stored as a scrypt hash. */
class SettingsStore {
  constructor(file) {
    this.file = file;
    this.data = structuredClone(DEFAULTS);
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data.screensaver = { ...this.data.screensaver, ...(saved.screensaver || {}) };
    } catch {
      // first run or unreadable file: keep defaults
    }
  }

  /** Settings as exposed to the renderer (no password hash). */
  getPublic() {
    const { password, ...screensaver } = this.data.screensaver;
    return { screensaver: { ...screensaver, hasPassword: !!password, presets: PRESETS } };
  }

  update(patch = {}) {
    const ss = this.data.screensaver;
    const p = patch.screensaver || {};
    if (p.preset !== undefined) {
      if (!PRESETS.includes(p.preset)) throw new Error(`未知的屏保样式: ${p.preset}`);
      ss.preset = p.preset;
    }
    if (p.showTranslation !== undefined) ss.showTranslation = !!p.showTranslation;
    if (p.lockEnabled !== undefined) {
      if (p.lockEnabled && !ss.password) throw new Error('请先设置解锁密码');
      ss.lockEnabled = !!p.lockEnabled;
    }
    this.#save();
    return this.getPublic();
  }

  setPassword(password) {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      throw new Error(`密码长度需为 ${PASSWORD_MIN}-${PASSWORD_MAX} 位`);
    }
    const salt = crypto.randomBytes(16);
    this.data.screensaver.password = { salt: salt.toString('hex'), hash: hashPassword(password, salt).toString('hex') };
    this.data.screensaver.lockEnabled = true;
    this.#save();
    return this.getPublic();
  }

  clearPassword() {
    this.data.screensaver.password = null;
    this.data.screensaver.lockEnabled = false;
    this.#save();
    return this.getPublic();
  }

  verifyPassword(password) {
    const stored = this.data.screensaver.password;
    if (!stored || typeof password !== 'string') return false;
    const expected = Buffer.from(stored.hash, 'hex');
    return crypto.timingSafeEqual(hashPassword(password, Buffer.from(stored.salt, 'hex')), expected);
  }

  isLockEnabled() {
    return this.data.screensaver.lockEnabled && !!this.data.screensaver.password;
  }

  #save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { SettingsStore, PRESETS };
