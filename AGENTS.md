# MusicDesktop

Electron desktop app that reads state from and controls **NetEase Cloud Music (网易云音乐) 3.x** for Windows
(verified against 3.1.42, CEF 91; the install location is auto-detected, see `NCM_PATH` below).

## Commands

- `npm run dev` – Vite dev server (HMR for the Vue renderer) + Electron (`tools/dev.mjs`). Main/preload edits need a restart.
- `npm start` – typecheck + `vite build` to `dist/renderer`, then run Electron on the build (`tools/start.js`).
  Both launchers strip `ELECTRON_RUN_AS_NODE`, which Electron-based IDE terminals export.
  `node tools/start.js other-entry.js` runs another Electron entry script instead of the app.
- `npm run dist` – build + electron-builder (config in package.json `build`): `release/FanhuaGG-<ver>-Setup.exe`
  (NSIS, per-user, zh_CN/en_US) and `release/FanhuaGG-<ver>-Portable.exe`; unpacked app in `release/win-unpacked`.
  Set `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/` (plus
  `ELECTRON_MIRROR`) here. Fuses are flipped (runAsNode off, asar-only + integrity), so the packaged exe ignores
  `ELECTRON_RUN_AS_NODE`; `--remote-debugging-port=9333` still works for `ui-probe`. Not code-signed.
  Don't run the installer for testing (creates shortcuts/uninstall entries) – test `win-unpacked` and the portable exe.
- `npm run icons` – `tools/make-icons.js` renders `build/icon.svg` (single logo source, also imported by
  AppHeader) with Electron offscreen rendering into `build/icon.png` (1024) and `build/icon.ico` (16–256).
- `npm run typecheck` (vue-tsc) / `npm run build` – **verification for renderer changes**; `node --check <file>` for
  the CommonJS files in `src/main`, `src/preload`, `tools`. No test framework yet.
- `npm run ncm -- <cmd>` / `node tools/ncm-cli.js <cmd> [--verbose]` – drive the controller without Electron.
  `<cmd>`: `status | watch | lyric | play | pause | toggle | next | prev | like | unlike | toggleLike | seek <sec>`.
- `node tools/cdp-eval.mjs "<js>"` (or `-f file.js`) – evaluate JS inside the NCM page; the main exploration tool.
- `node tools/ui-probe.mjs eval|shot|move|type|key ...` – inspect/drive the app's own renderer; start the app with
  `npm start -- --remote-debugging-port=9333` (or `npm run dev -- ...`). `shot out.png` + reading the PNG = visual check.

Env: `NCM_DEBUG_PORT` (default 9222), `NCM_PATH` (cloudmusic.exe; otherwise auto-detected from the running
process, registry `HKLM\SOFTWARE\WOW6432Node\Netease\CloudMusic\install_dir`, or default install paths),
`MUSIC_DESKTOP_USER_DATA` (separate profile dir: own settings.json + single-instance lock). **Test screensaver/lock
flows with a temp profile** – the user's real profile (`%APPDATA%\FanhuaGG\settings.json`, fixed in main.js for dev
and packaged builds; copied once from the old `%APPDATA%\music-desktop`) has their own password; never change or
clear it, and never lock the user's screen with a password they don't know.
npm registry is npmmirror; set `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` when (re)installing
Electron, and run `node node_modules/electron/install.js` if `node_modules/electron/dist` is missing.
TypeScript is pinned to 6.x (vue-tsc needs the JS-based compiler API; TS 7 is the native port).

## Git

- Commit messages in Chinese. Write the message to a UTF-8 file and use `git commit -F <file>` (PowerShell would
  mangle Chinese passed as arguments). Don't change git config.
- `.gitattributes` forces LF (overrides global `core.autocrlf=true`); all text files are UTF-8 without BOM (`.editorconfig`).

## Architecture

- `src/main/ncm/process.js` – find/launch/kill `cloudmusic.exe` (`tasklist`, PowerShell CIM, `taskkill`).
  Launches via `cmd /c start` so NCM is not in the app's process tree.
- `src/main/ncm/cdp.js` – minimal Chrome DevTools Protocol client (`ws`).
- `src/main/ncm/controller.js` – `NcmController` (EventEmitter). Supervision loop: NCM must run with
  `--remote-debugging-port`; if it runs without, it is force-killed and relaunched (`autoRestart`). It is launched
  when the app starts (`autoLaunch`) but not after the user quits it (`relaunchOnExit: false`). Connects to page
  `orpheus://orpheus/pub/app.html`, registers binding `__musicDesktopEmit`, injects the page bridge, re-injects on
  page reload. `reconnect()` drops the connection and reconnects now (launching NCM even after the user quit it).
  Emits `state` (full snapshot) and `progress`.
- `src/main/ncm/page-bridge.js` – runs **inside NCM** (serialized via `toString()`, must be self-contained).
  Version = hash of its source, so edits replace the copy already living in the page. Shared by several
  controllers (app + CLI) via client ref-counting; removed when the last one calls `release`.
- `src/main/main.js` – app id `com.fanhuagg.desktop` (= build.appId), userData `%APPDATA%\FanhuaGG`.
  Frameless window (custom title bar), content kept at exactly **9:16**: on Windows the native
  aspect ratio applies to the OS rect incl. invisible resize borders (`extraSize` ignored), so the ratio is
  recomputed from the content height after every resize (`applyAspectRatio`). Loads `VITE_DEV_SERVER_URL` in dev,
  else `dist/renderer/index.html`; no app menu in production.
- `src/main/settings.js` – `settings.json` in userData. `appearance`: home cover layout (`stacked|side`), cover size
  in % of window width **kept per layout** (clamped to `COVER_SIZE_RANGE`), font family (sanitized, '' = default).
  `screensaver`: preset (`lyrics|vinyl|clock`), translation toggle, lock flag, password as salted scrypt hash (never
  sent to the renderer). Old files are merged with defaults on load.
- `src/main/fonts.js` – installed font families via PowerShell `System.Drawing.Text.InstalledFontCollection`
  (localized names like 微软雅黑, CJK first; drops symbol fonts and GDI-truncated 31-char names); cached.
  The renderer applies the font through the `--font` CSS variable on `<html>` (App.vue).
- `src/main/screensaver.js` – screensaver state lives in main: kiosk + always-on-top, blocks window close while
  locked, verifies the password (5 failures → 30 s lockout), restores bounds/aspect on exit.
- `src/preload/preload.js` – `window.ncm` (getState, command, reconnect, onState, onProgress) and `window.desktop`
  (minimize, close, settings.*, fonts.list, screensaver.*). Types in `src/renderer/types.ts`.
- `src/renderer/` – Vite + Vue 3 + TS (`vite.config.mts`, root `tsconfig.json`). Singleton composables in
  `composables/` (`useNcm` interpolates progress with rAF, `useIdle` = 10 s idle detection ignoring synthetic
  mousemoves); components in `components/`, screensaver presets in `components/screensaver/`.

## NCM 3.1.42 internals (verified)

- Redux (dva) store: React root `#root.__reactContainer*` → fiber whose `memoizedProps.store` has `getState().playing`.
- `state.playing`: `curPlaying`, `curTrack`, `resourceTrackId`, `onlineResourceId`, `playId`, `resourceName`,
  `resourceArtists`, `resourceCoverUrl`, `resourceDuration` (s), `playingState` (End -1 / Stop 0 / Pause 1 / Playing 2),
  `playingMode` (`playCycle|playOneCycle|playRandom|playOrder|playAi|playFm`).
- Liked: `state['async:hostResource'].likeTracksMap[trackId]`.
- Lyrics: `state['async:lyric']` (`resourceTrackId`, `lyricLines`/`tlyricLines`/`romaLyricLines` of `{time, lyric}`),
  only filled on demand → dispatch `async:lyric/fetchLyric {force:true}`. Fallback: in-page fetch
  `https://music.163.com/api/song/lyric/v1?id=..&lv=0&tv=0&rv=0`.
- Progress: `window.dbg.Command.rxFromNativeEvent('audioplayer.onPlayProgress')` → `[playId, seconds, ?]` every ~30 ms
  while playing; paused fallback: DOM `.curtime-thumb` ("mm:ss / mm:ss").
- Actions: `playing/resume {triggerScene:'miniBar'}`, `playing/pause`, `playing/switchResumeOrPause`,
  `playingList/jump2Track {flag:±1, type:'call', triggerScene}` (FM: `fmPlaying/playNext|playPre`),
  `playing/setPlayingPosition {duration: sec}`, `async:hostResource/setLikeCurPlayingTrack {}` (toggle; the state
  update lands asynchronously, so poll `likeTracksMap`).
- Find more by grepping the bundle in-page: fetch `orpheus://orpheus/pub/hybrid/app.chunk.*.js` (and lazy chunks from
  `performance.getEntriesByType('resource')`) via `Runtime.evaluate`; DevTools `getScriptSource` fails for the 5 MB chunk.
- Store-dispatch monkeypatching doesn't see UI actions (components captured the original dispatch).
