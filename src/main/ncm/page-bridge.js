'use strict';

/**
 * Runs INSIDE the NetEase Cloud Music renderer (orpheus://orpheus/pub/app.html), injected via CDP.
 * Must be fully self-contained: it is serialized with Function#toString().
 *
 * Verified against NCM 3.1.42 internals:
 *   - Redux (dva) store on the React root Provider; state.playing / state['async:lyric'] / state['async:hostResource']
 *   - playingState enum: End=-1, Stop=0, Pause=1, Playing=2
 *   - progress via native event dbg.Command.rxFromNativeEvent('audioplayer.onPlayProgress') -> [playId, seconds, ?]
 */
function pageBridge(bindingName, version, clientId) {
  const existing = window.__musicDesktop;
  if (existing && existing.version === version) {
    existing.clients.add(clientId);
    existing.resync();
    return 'resynced';
  }
  // Several controllers (app + CLI) may share one bridge; it is removed when the last one releases it.
  const clients = new Set(existing && existing.clients ? existing.clients : []);
  clients.add(clientId);
  if (existing && typeof existing.dispose === 'function') existing.dispose();

  const PLAYING = 2;
  const SCENE = 'miniBar';
  // NCM keeps its queue in a "file" (playingList) or "db" (dbPlayingList) model; 3.1.x uses the file one.
  const PLAYLIST_MODEL = 'playingList';
  const PROGRESS_INTERVAL = 250;
  const LYRIC_FALLBACK_AFTER = 5000;

  const disposers = [];
  let store = null;
  let disposed = false;
  let lastPlayerJson = '';
  let lastLyricKey = '';
  let lyricRefs = null;
  let lyricRequest = null; // { trackId, at, fallback }
  let fallbackLyric = null; // { trackId, status, lines }
  let position = 0;
  let positionPlayId = '';
  let lastProgressEmit = 0;
  let lastProgressEventAt = 0;

  const emit = (type, data) => {
    const fn = window[bindingName];
    if (typeof fn !== 'function') return;
    try {
      fn(JSON.stringify({ type, data }));
    } catch (e) {}
  };

  function findStore() {
    const root = document.querySelector('#root');
    if (!root) return null;
    const key = Object.getOwnPropertyNames(root).find((k) => k.startsWith('__reactContainer'));
    if (!key) return null;
    const stack = [root[key]];
    for (let visited = 0; stack.length && visited < 20000; visited++) {
      const node = stack.pop();
      if (!node) continue;
      const s = node.memoizedProps && node.memoizedProps.store;
      if (s && typeof s.getState === 'function' && typeof s.dispatch === 'function' && s.getState().playing) return s;
      if (node.sibling) stack.push(node.sibling);
      if (node.child) stack.push(node.child);
    }
    return null;
  }

  const artistsOf = (list) =>
    (Array.isArray(list) ? list : [])
      .map((a) => ({ id: a && a.id != null ? String(a.id) : '', name: (a && a.name) || '' }))
      .filter((a) => a.name);

  function readPlayer(st) {
    const p = st.playing || {};
    const cur = p.curPlaying;
    const t = p.curTrack || (cur && cur.track) || {};
    const local = (cur && cur.localTrack) || {};
    const album = t.album || local.album || {};
    const id = String(p.resourceTrackId || p.onlineResourceId || t.id || '');
    const likeId = String(p.onlineResourceId || id);
    const likeMap = (st['async:hostResource'] || {}).likeTracksMap || {};
    return {
      track: cur
        ? {
            id,
            playId: p.playId || '',
            name: p.resourceName || t.name || local.name || '',
            artists: artistsOf(p.resourceArtists && p.resourceArtists.length ? p.resourceArtists : t.artists || local.artists),
            album: { id: album.id != null ? String(album.id) : '', name: album.name || album.albumName || '' },
            coverUrl: p.resourceCoverUrl || album.picUrl || '',
            duration: Number(p.resourceDuration) || (t.duration ? t.duration / 1000 : 0),
            resourceType: p.resourceType || '',
          }
        : null,
      playingState: p.playingState,
      playing: p.playingState === PLAYING,
      playingMode: p.playingMode || '',
      volume: typeof p.playingVolume === 'number' ? p.playingVolume : null,
      liked: !!(likeId && likeMap[likeId]),
    };
  }

  // ---------- progress ----------
  function emitProgress() {
    lastProgressEmit = Date.now();
    const st = store && store.getState();
    emit('progress', {
      playId: positionPlayId,
      position,
      playing: !!st && st.playing.playingState === PLAYING,
    });
  }

  function readDomPosition() {
    const el = document.querySelector('.curtime-thumb');
    const m = el && /(\d+):(\d{2})/.exec(el.textContent || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  // ---------- lyrics ----------
  const timeKey = (t) => Math.round(Number(t) * 100);

  function mergeLines(main, trans, roma) {
    const index = (arr) => {
      const m = new Map();
      (arr || []).forEach((l) => l && l.text && m.set(timeKey(l.time), l.text));
      return m;
    };
    const tmap = index(trans);
    const rmap = index(roma);
    return (main || [])
      .filter((l) => l && Number.isFinite(Number(l.time)))
      .map((l) => ({
        time: Number(l.time),
        text: l.text || '',
        translation: tmap.get(timeKey(l.time)) || '',
        roma: rmap.get(timeKey(l.time)) || '',
      }))
      .sort((a, b) => a.time - b.time);
  }

  const fromNcm = (arr) => (arr || []).map((l) => ({ time: l.time, text: l.lyric }));

  function parseLrc(text) {
    const out = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      if (raw.startsWith('{')) {
        try {
          const j = JSON.parse(raw);
          out.push({ time: (j.t || 0) / 1000, text: (j.c || []).map((c) => c.tx || '').join('') });
        } catch (e) {}
        continue;
      }
      const tags = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
      if (!tags.length) continue;
      const text = raw.replace(/\[[^\]]*\]/g, '').trim();
      for (const m of tags) out.push({ time: Number(m[1]) * 60 + Number(m[2]), text });
    }
    return out;
  }

  async function fetchFallbackLyric(trackId) {
    if (!/^\d+$/.test(trackId)) {
      fallbackLyric = { trackId, status: 'none', lines: [] };
      return;
    }
    try {
      const res = await fetch(`https://music.163.com/api/song/lyric/v1?id=${trackId}&lv=0&tv=0&rv=0`);
      const d = await res.json();
      const lines = d.lrc && d.lrc.lyric ? mergeLines(parseLrc(d.lrc.lyric), parseLrc(d.tlyric && d.tlyric.lyric), parseLrc(d.romalrc && d.romalrc.lyric)) : [];
      fallbackLyric = { trackId, status: lines.length ? 'ok' : 'none', lines };
    } catch (e) {
      fallbackLyric = { trackId, status: 'failed', lines: [] };
    }
    if (store) syncLyric(store.getState(), readPlayer(store.getState()).track);
  }

  function emitLyric(key, data) {
    if (key === lastLyricKey) return;
    lastLyricKey = key;
    emit('lyric', data);
  }

  function syncLyric(st, track) {
    const trackId = track ? track.id : '';
    if (!trackId) {
      emitLyric('empty', { trackId: '', status: 'none', source: '', lines: [] });
      return;
    }
    const ly = st['async:lyric'];
    const matches = !!ly && String(ly.resourceTrackId || '') === trackId && !ly.isLoading;
    if (matches && Array.isArray(ly.lyricLines) && ly.lyricLines.length) {
      const refs = [trackId, ly.lyricLines, ly.tlyricLines, ly.romaLyricLines];
      if (!lyricRefs || refs.some((r, i) => r !== lyricRefs[i])) {
        lyricRefs = refs;
        const lines = mergeLines(fromNcm(ly.lyricLines), fromNcm(ly.tlyricLines), fromNcm(ly.romaLyricLines));
        lastLyricKey = '';
        emitLyric(`ncm|${trackId}`, { trackId, status: 'ok', source: 'ncm', lines });
      }
      return;
    }
    if (fallbackLyric && fallbackLyric.trackId === trackId) {
      emitLyric(`api|${trackId}|${fallbackLyric.status}`, { trackId, status: fallbackLyric.status, source: 'api', lines: fallbackLyric.lines });
      return;
    }
    const now = Date.now();
    if (!lyricRequest || lyricRequest.trackId !== trackId) {
      lyricRequest = { trackId, at: now, fallback: false };
      emitLyric(`loading|${trackId}`, { trackId, status: 'loading', source: '', lines: [] });
      const ncmAlreadyLoading = !!ly && String(ly.resourceTrackId || '') === trackId && ly.isLoading;
      if (!ncmAlreadyLoading) {
        try {
          store.dispatch({ type: 'async:lyric/fetchLyric', payload: { force: true } });
        } catch (e) {}
      }
      return;
    }
    const ncmGaveUp = matches && (ly.isLyricFetchFailed || !(ly.lyricLines || []).length);
    if (!lyricRequest.fallback && (ncmGaveUp || now - lyricRequest.at > LYRIC_FALLBACK_AFTER)) {
      lyricRequest.fallback = true;
      fetchFallbackLyric(trackId);
    }
  }

  // ---------- state sync ----------
  function onStoreChange() {
    if (disposed || !store) return;
    const st = store.getState();
    const player = readPlayer(st);
    const json = JSON.stringify(player);
    if (json !== lastPlayerJson) {
      const prev = lastPlayerJson ? JSON.parse(lastPlayerJson) : null;
      lastPlayerJson = json;
      if (player.track && (!prev || !prev.track || prev.track.playId !== player.track.playId) && positionPlayId !== player.track.playId) {
        position = 0;
        positionPlayId = player.track.playId;
      }
      emit('player', player);
      emitProgress();
    }
    syncLyric(st, player.track);
  }

  function tick() {
    if (disposed || !store) return;
    const st = store.getState();
    syncLyric(st, readPlayer(st).track);
    if (st.playing.playingState !== PLAYING && Date.now() - lastProgressEventAt > 1500) {
      const dom = readDomPosition();
      if (dom !== null && Math.abs(dom - position) >= 1.5) {
        position = dom;
        emitProgress();
      }
    }
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('NCM action timed out')), ms))]);
  }

  async function waitFor(predicate, ms) {
    for (const deadline = Date.now() + ms; Date.now() < deadline; ) {
      if (predicate()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return predicate();
  }

  async function exec(cmd, arg) {
    if (!store) throw new Error('NCM store not ready');
    const st = store.getState();
    const p = st.playing;
    const isFm = p.playingMode === 'playFm';
    const dispatch = (action) => withTimeout(Promise.resolve(store.dispatch(action)), 10000);
    switch (cmd) {
      case 'play':
        if (p.playingState !== PLAYING) await dispatch({ type: 'playing/resume', payload: { triggerScene: SCENE } });
        break;
      case 'pause':
        if (p.playingState === PLAYING) await dispatch({ type: 'playing/pause' });
        break;
      case 'toggle':
        await dispatch({ type: 'playing/switchResumeOrPause', payload: { triggerScene: SCENE } });
        break;
      case 'next':
      case 'prev': {
        const flag = cmd === 'next' ? 1 : -1;
        if (isFm) await dispatch({ type: flag === 1 ? 'fmPlaying/playNext' : 'fmPlaying/playPre', payload: {} });
        else await dispatch({ type: `${PLAYLIST_MODEL}/jump2Track`, payload: { flag, type: 'call', triggerScene: SCENE } });
        break;
      }
      case 'like':
      case 'unlike':
      case 'toggleLike': {
        const liked = readPlayer(st).liked;
        const want = cmd === 'toggleLike' ? !liked : cmd === 'like';
        if (want === liked) break;
        // The effect forwards to setLikeTrack with a non-blocking put, so wait for likeTracksMap to change.
        await dispatch({ type: 'async:hostResource/setLikeCurPlayingTrack', payload: {} });
        const changed = await waitFor(() => readPlayer(store.getState()).liked === want, 6000);
        if (!changed) return { ok: false, message: '喜欢状态未改变（可能未登录或离线）', player: readPlayer(store.getState()) };
        break;
      }
      case 'seek': {
        const sec = Number(arg);
        if (!Number.isFinite(sec) || sec < 0) throw new Error('Invalid seek position');
        await dispatch({ type: 'playing/setPlayingPosition', payload: { duration: sec } });
        position = sec;
        emitProgress();
        break;
      }
      default:
        throw new Error('Unknown command: ' + cmd);
    }
    return { ok: true, player: readPlayer(store.getState()) };
  }

  function resync() {
    if (!store) return;
    lastPlayerJson = '';
    lastLyricKey = '';
    lyricRefs = null;
    emit('ready', { version });
    onStoreChange();
  }

  function attach(s) {
    store = s;
    disposers.push(store.subscribe(onStoreChange));
    const cmd = window.dbg && window.dbg.Command;
    if (cmd && typeof cmd.rxFromNativeEvent === 'function') {
      const sub = cmd.rxFromNativeEvent('audioplayer.onPlayProgress').subscribe((e) => {
        if (!Array.isArray(e)) return;
        position = Number(e[1]) || 0;
        positionPlayId = String(e[0] || '');
        lastProgressEventAt = Date.now();
        if (lastProgressEventAt - lastProgressEmit >= PROGRESS_INTERVAL) emitProgress();
      });
      disposers.push(() => sub.unsubscribe());
    } else {
      emit('warn', 'dbg.Command.rxFromNativeEvent unavailable; progress falls back to DOM');
    }
    const timer = setInterval(tick, 1000);
    disposers.push(() => clearInterval(timer));
    const dom = readDomPosition();
    if (dom !== null) position = dom;
    resync();
  }

  function dispose() {
    disposed = true;
    disposers.splice(0).forEach((d) => {
      try {
        d();
      } catch (e) {}
    });
    if (window.__musicDesktop === api) delete window.__musicDesktop;
  }

  function release(id) {
    clients.delete(id);
    if (!clients.size) dispose();
    return clients.size;
  }

  const api = { version, clients, exec, resync, dispose, release };
  window.__musicDesktop = api;

  (function waitForStore(attempt) {
    if (disposed) return;
    const s = findStore();
    if (s) return attach(s);
    if (attempt % 20 === 0) emit('warn', 'waiting for NCM Redux store...');
    const t = setTimeout(() => waitForStore(attempt + 1), 500);
    disposers.push(() => clearTimeout(t));
  })(0);

  return 'installed';
}

module.exports = { pageBridge };
