import type { ScreensaverPreset } from '../../types';
import type { IconName } from '../icons';

export const PRESET_INFO: Record<ScreensaverPreset, { name: string; desc: string; icon: IconName }> = {
  lyrics: { name: '歌词', desc: '模糊封面背景，大字滚动歌词', icon: 'lyrics' },
  vinyl: { name: '黑胶', desc: '旋转黑胶唱片，搭配当前歌词', icon: 'disc' },
  clock: { name: '时钟', desc: '大号时钟，底部显示正在播放', icon: 'clock' },
};
