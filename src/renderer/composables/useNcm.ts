import { computed, ref, shallowRef } from 'vue';
import type { ConnectionStatus, LyricState, NcmCommand, NcmState, Progress } from '../types';
import { findLineIndex } from '../utils/format';
import { useToast } from './useToast';

/** Highlight a lyric line slightly before its timestamp so it feels in sync. */
const LYRIC_LEAD = 0.15;
const BUSY: ConnectionStatus[] = ['connecting', 'launching', 'restarting'];
const EMPTY_LYRIC: LyricState = { trackId: '', status: 'none', source: '', lines: [] };

const state = shallowRef<NcmState | null>(null);
/** Interpolated playback position (seconds), refreshed every animation frame. */
const position = ref(0);
let sample = { position: 0, at: 0, playing: false };
let initialized = false;

function livePosition(): number {
  const duration = state.value?.track?.duration ?? 0;
  const pos = sample.position + (sample.playing ? (Date.now() - sample.at) / 1000 : 0);
  return duration ? Math.min(pos, duration) : pos;
}

function applyState(s: NcmState) {
  state.value = s;
  sample = { position: s.progress.position, at: s.progress.at, playing: s.playing };
}

function applyProgress(p: Progress) {
  const playing = !!p.playing;
  sample = { position: p.position, at: p.at, playing };
  if (state.value && state.value.playing !== playing) state.value = { ...state.value, playing };
}

function tick() {
  position.value = livePosition();
  requestAnimationFrame(tick);
}

function init() {
  if (initialized) return;
  initialized = true;
  window.ncm.onState(applyState);
  window.ncm.onProgress(applyProgress);
  window.ncm.getState().then((s) => !state.value && applyState(s));
  requestAnimationFrame(tick);
}

export function useNcm() {
  init();
  const { show } = useToast();

  const track = computed(() => state.value?.track ?? null);
  const connection = computed(() => state.value?.connection ?? { status: 'idle' as ConnectionStatus, message: '初始化中...' });
  const connected = computed(() => connection.value.status === 'connected');
  const busy = computed(() => BUSY.includes(connection.value.status));
  const canControl = computed(() => connected.value && !!track.value);
  const playing = computed(() => !!state.value?.playing);
  const liked = computed(() => !!state.value?.liked);
  const duration = computed(() => track.value?.duration ?? 0);

  const lyric = computed(() => state.value?.lyric ?? EMPTY_LYRIC);
  /** 'loading' while the lyric still belongs to the previous track. */
  const lyricStatus = computed<LyricState['status']>(() => {
    if (!track.value) return 'none';
    return lyric.value.trackId === track.value.id ? lyric.value.status : 'loading';
  });
  const lines = computed(() => (lyricStatus.value === 'ok' ? lyric.value.lines : []));
  const lineIndex = computed(() => findLineIndex(lines.value, position.value + LYRIC_LEAD));
  const lineAt = (offset: number) => lines.value[lineIndex.value + offset] ?? null;
  const currentLine = computed(() => lineAt(0));

  async function command(name: NcmCommand, arg?: unknown) {
    const res = await window.ncm.command(name, arg);
    if (!res || !res.ok) show(res?.message || '操作失败');
    return res;
  }

  function seek(seconds: number) {
    sample = { position: seconds, at: Date.now(), playing: sample.playing };
    position.value = seconds;
    return command('seek', seconds);
  }

  const reconnect = () => window.ncm.reconnect();

  return {
    track,
    connection,
    connected,
    busy,
    canControl,
    playing,
    liked,
    duration,
    position,
    lyricStatus,
    lines,
    lineIndex,
    lineAt,
    currentLine,
    command,
    seek,
    reconnect,
  };
}
