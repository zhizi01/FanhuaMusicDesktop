'use strict';

const $ = (id) => document.getElementById(id);
const els = {
  backdrop: $('backdrop'),
  status: $('status'),
  statusText: $('statusText'),
  cover: $('cover'),
  title: $('title'),
  artist: $('artist'),
  album: $('album'),
  lyrics: $('lyrics'),
  lyricsInner: $('lyricsInner'),
  bar: $('bar'),
  barFill: $('barFill'),
  barThumb: $('barThumb'),
  timeCur: $('timeCur'),
  timeDur: $('timeDur'),
  btnPlay: $('btnPlay'),
  btnLike: $('btnLike'),
  toast: $('toast'),
};
const cmdButtons = [...document.querySelectorAll('[data-cmd]')];

let state = null;
let progress = { position: 0, at: 0, playing: false };
let lyricKey = '';
let lineEls = [];
let activeLine = -1;
let dragFraction = null;
let userScrollUntil = 0;
let toastTimer = null;

const fmt = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const coverSrc = (url) => (!url ? '' : /music\.126\.net/.test(url) && !url.includes('?') ? `${url}?param=400y400` : url);
const canControl = () => !!state && state.connection.status === 'connected' && !!state.track;

function currentPosition() {
  const duration = (state && state.track && state.track.duration) || 0;
  const pos = progress.position + (progress.playing ? (Date.now() - progress.at) / 1000 : 0);
  return duration ? Math.min(pos, duration) : pos;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 2500);
}

async function run(cmd, arg) {
  const res = await window.ncm.command(cmd, arg);
  if (!res || !res.ok) showToast((res && res.message) || '操作失败');
}

function seek(seconds) {
  progress = { position: seconds, at: Date.now(), playing: progress.playing };
  run('seek', seconds);
}

// ---------- state rendering ----------

function applyState(s) {
  state = s;
  const { connection, track } = s;
  els.status.dataset.status = connection.status;
  els.statusText.textContent = connection.message || connection.status;

  const artists = track ? track.artists.map((a) => a.name).join(' / ') : '';
  els.title.textContent = track ? track.name : '未在播放';
  els.artist.textContent = track ? artists || '未知歌手' : '—';
  els.album.textContent = (track && track.album && track.album.name) || '';
  document.title = track ? `${track.name} - ${artists}` : 'Music Desktop';

  const src = coverSrc(track && track.coverUrl);
  if (els.cover.dataset.src !== src) {
    els.cover.dataset.src = src;
    els.cover.hidden = !src;
    if (src) els.cover.src = src;
    else els.cover.removeAttribute('src');
    els.backdrop.style.backgroundImage = src ? `url("${src}")` : '';
  }

  els.btnPlay.classList.toggle('playing', s.playing);
  els.btnLike.classList.toggle('liked', s.liked);
  els.btnLike.title = s.liked ? '取消喜欢' : '喜欢';
  cmdButtons.forEach((b) => (b.disabled = !canControl()));

  progress = { position: s.progress.position, at: s.progress.at, playing: s.playing };
  els.timeDur.textContent = fmt(track && track.duration);
  renderLyrics(s.lyric, track);
}

function lyricMessage(text) {
  const div = document.createElement('div');
  div.className = 'lyrics-empty';
  div.textContent = text;
  els.lyricsInner.append(div);
}

function renderLyrics(lyric, track) {
  const stale = !!track && lyric.trackId !== track.id;
  const key = track ? `${track.id}|${lyric.trackId}|${lyric.status}|${lyric.source}|${lyric.lines.length}|${lyric.lines.filter((l) => l.translation).length}` : '';
  if (key === lyricKey) return;
  lyricKey = key;
  activeLine = -1;
  lineEls = [];
  els.lyricsInner.replaceChildren();
  els.lyrics.scrollTop = 0;
  if (!track) return;
  if (stale || lyric.status === 'loading') return lyricMessage('歌词加载中...');
  if (!lyric.lines.length) return lyricMessage(lyric.status === 'failed' ? '歌词获取失败' : '暂无歌词');

  const frag = document.createDocumentFragment();
  for (const line of lyric.lines) {
    const div = document.createElement('div');
    div.className = 'line';
    div.textContent = line.text || '♪';
    if (line.translation) {
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = line.translation;
      div.append(sub);
    }
    div.addEventListener('click', () => canControl() && seek(line.time));
    frag.append(div);
    lineEls.push(div);
  }
  els.lyricsInner.append(frag);
}

function updateActiveLine(pos) {
  if (!lineEls.length) return;
  const lines = state.lyric.lines;
  let lo = 0;
  let hi = lines.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= pos + 0.15) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (idx === activeLine) return;
  if (lineEls[activeLine]) lineEls[activeLine].classList.remove('active');
  activeLine = idx;
  const el = lineEls[idx];
  if (!el) return;
  el.classList.add('active');
  if (Date.now() > userScrollUntil) {
    els.lyrics.scrollTo({ top: el.offsetTop - els.lyrics.clientHeight / 2 + el.offsetHeight / 2, behavior: 'smooth' });
  }
}

function frame() {
  const duration = (state && state.track && state.track.duration) || 0;
  const pos = currentPosition();
  const shown = dragFraction !== null ? dragFraction * duration : pos;
  const pct = duration ? Math.min(100, (shown / duration) * 100) : 0;
  els.barFill.style.width = `${pct}%`;
  els.barThumb.style.left = `${pct}%`;
  const cur = fmt(state && state.track ? shown : 0);
  if (els.timeCur.textContent !== cur) els.timeCur.textContent = cur;
  if (state && state.track) updateActiveLine(pos);
  requestAnimationFrame(frame);
}

// ---------- interactions ----------

cmdButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    btn.blur();
    run(btn.dataset.cmd);
  })
);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && canControl()) {
    e.preventDefault();
    run('toggle');
  }
});

els.lyrics.addEventListener('wheel', () => (userScrollUntil = Date.now() + 3000), { passive: true });

const fractionAt = (e) => {
  const r = els.bar.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
};
const endDrag = () => {
  dragFraction = null;
  els.bar.classList.remove('dragging');
};
els.bar.addEventListener('pointerdown', (e) => {
  if (!canControl() || !state.track.duration) return;
  els.bar.setPointerCapture(e.pointerId);
  els.bar.classList.add('dragging');
  dragFraction = fractionAt(e);
});
els.bar.addEventListener('pointermove', (e) => {
  if (dragFraction !== null) dragFraction = fractionAt(e);
});
els.bar.addEventListener('pointerup', (e) => {
  if (dragFraction === null) return;
  const seconds = fractionAt(e) * state.track.duration;
  endDrag();
  seek(seconds);
});
els.bar.addEventListener('pointercancel', endDrag);

els.cover.addEventListener('error', () => {
  els.cover.hidden = true;
  els.backdrop.style.backgroundImage = '';
});

// ---------- bootstrap ----------

window.ncm.onState(applyState);
window.ncm.onProgress((p) => {
  progress = { position: p.position, at: p.at, playing: p.playing };
  if (!state) return;
  state.playing = p.playing;
  els.btnPlay.classList.toggle('playing', p.playing);
});
window.ncm.getState().then((s) => !state && applyState(s));
requestAnimationFrame(frame);
