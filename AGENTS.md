# MusicDesktop

Electron desktop app that reads state from and controls **NetEase Cloud Music (网易云音乐) 3.x** for Windows
(verified against 3.1.42, CEF 91, installed at `D:\AppFile\CloudMusic`).

## Commands

- `npm start` – run the Electron app (`tools/start.js` strips `ELECTRON_RUN_AS_NODE`, which IDE terminals export).
  Append `-- --remote-debugging-port=9333` to inspect the app's own renderer over CDP.
- `npm run ncm -- <cmd>` / `node tools/ncm-cli.js <cmd> [--verbose]` – drive the controller without Electron.
  `<cmd>`: `status | watch | lyric | play | pause | toggle | next | prev | like | unlike | toggleLike | seek <sec>`.
- `node tools/cdp-eval.mjs "<js>"` (or `-f file.js`) – evaluate JS inside the NCM page; the main exploration tool.
- Syntax check: `node --check <file>` for every file under `src/` and `tools/`. No test framework yet.

Env: `NCM_DEBUG_PORT` (default 9222), `NCM_PATH` (cloudmusic.exe; otherwise auto-detected from the running
process, registry `HKLM\SOFTWARE\WOW6432Node\Netease\CloudMusic\install_dir`, or default install paths).
npm registry is npmmirror; set `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` when (re)installing
Electron, and run `node node_modules/electron/install.js` if `node_modules/electron/dist` is missing.

## Architecture

- `src/main/ncm/process.js` – find/launch/kill `cloudmusic.exe` (`tasklist`, PowerShell CIM, `taskkill`).
- `src/main/ncm/cdp.js` – minimal Chrome DevTools Protocol client (`ws`).
- `src/main/ncm/controller.js` – `NcmController` (EventEmitter). Supervision loop: NCM must run with
  `--remote-debugging-port`; if it runs without, it is force-killed and relaunched (`autoRestart`). It is launched
  when the app starts (`autoLaunch`) but not after the user quits it (`relaunchOnExit: false`). Connects to page
  `orpheus://orpheus/pub/app.html`, registers binding `__musicDesktopEmit`, injects the page bridge, re-injects on
  page reload. Emits `state` (full snapshot) and `progress`.
- `src/main/ncm/page-bridge.js` – runs **inside NCM** (serialized via `toString()`, must be self-contained).
  Version = hash of its source, so edits replace the copy already living in the page.
- `src/main/main.js` / `src/preload/preload.js` – IPC: `ncm:get-state`, `ncm:command`, push `ncm:state`, `ncm:progress`.
  Renderer API: `window.ncm.{getState, command, onState, onProgress}`.
- `src/renderer/` – plain HTML/CSS/JS UI (no bundler); interpolates progress with rAF.

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
