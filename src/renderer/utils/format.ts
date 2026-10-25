export function formatTime(seconds: number | undefined): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** NetEase CDN images accept ?param=WxH for server-side resizing. */
export function coverUrl(url: string | undefined, size = 400): string {
  if (!url) return '';
  return /music\.126\.net/.test(url) && !url.includes('?') ? `${url}?param=${size}y${size}` : url;
}

export const artistNames = (artists: { name: string }[] | undefined): string => (artists || []).map((a) => a.name).join(' / ');

/** Index of the last line whose time <= position (binary search), -1 before the first line. */
export function findLineIndex(lines: { time: number }[], position: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= position) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return idx;
}
