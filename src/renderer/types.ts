// Mirrors the state produced by src/main/ncm/controller.js and the APIs exposed by src/preload/preload.js.

export type ConnectionStatus =
  | 'idle'
  | 'launching'
  | 'restarting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'waiting'
  | 'need-restart'
  | 'error';

export interface Artist {
  id: string;
  name: string;
}

export interface Track {
  id: string;
  playId: string;
  name: string;
  artists: Artist[];
  album: { id: string; name: string };
  coverUrl: string;
  /** seconds */
  duration: number;
  resourceType: string;
}

export interface LyricLine {
  /** seconds */
  time: number;
  text: string;
  translation: string;
  roma: string;
}

export interface LyricState {
  trackId: string;
  status: 'loading' | 'ok' | 'none' | 'failed';
  source: string;
  lines: LyricLine[];
}

export interface Progress {
  /** seconds */
  position: number;
  playId: string;
  /** Date.now() when the position was sampled */
  at: number;
  playing?: boolean;
}

export interface NcmState {
  connection: { status: ConnectionStatus; message: string };
  track: Track | null;
  playing: boolean;
  playingState: number;
  playingMode: string;
  liked: boolean;
  volume: number | null;
  progress: Progress;
  lyric: LyricState;
}

export type NcmCommand = 'play' | 'pause' | 'toggle' | 'next' | 'prev' | 'like' | 'unlike' | 'toggleLike' | 'seek';

export interface Result {
  ok: boolean;
  message?: string;
}

export type ScreensaverPreset = 'lyrics' | 'vinyl' | 'clock';

export interface Settings {
  screensaver: {
    preset: ScreensaverPreset;
    showTranslation: boolean;
    lockEnabled: boolean;
    hasPassword: boolean;
    presets: ScreensaverPreset[];
  };
}

export interface SettingsPatch {
  screensaver?: Partial<Pick<Settings['screensaver'], 'preset' | 'showTranslation' | 'lockEnabled'>>;
}

export interface SettingsResult extends Result {
  settings?: Settings;
}

export interface ScreensaverState {
  active: boolean;
  locked: boolean;
}

type Unsubscribe = () => void;

export interface NcmApi {
  getState(): Promise<NcmState>;
  command(name: NcmCommand, arg?: unknown): Promise<Result>;
  reconnect(): Promise<Result>;
  onState(cb: (state: NcmState) => void): Unsubscribe;
  onProgress(cb: (progress: Progress) => void): Unsubscribe;
}

export interface DesktopApi {
  minimize(): Promise<void>;
  close(): Promise<void>;
  settings: {
    get(): Promise<Settings>;
    update(patch: SettingsPatch): Promise<SettingsResult>;
    setPassword(password: string): Promise<SettingsResult>;
    clearPassword(): Promise<SettingsResult>;
  };
  screensaver: {
    getState(): Promise<ScreensaverState>;
    enter(): Promise<ScreensaverState>;
    exit(password?: string): Promise<Result>;
    onChange(cb: (state: ScreensaverState) => void): Unsubscribe;
  };
}

declare global {
  interface Window {
    ncm: NcmApi;
    desktop: DesktopApi;
  }
}
