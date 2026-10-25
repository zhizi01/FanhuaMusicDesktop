#!/usr/bin/env node
'use strict';

// Usage: node tools/ncm-cli.js <status|watch|play|pause|toggle|next|prev|like|unlike|toggleLike|seek <sec>|lyric> [--verbose]
const { NcmController, COMMANDS } = require('../src/main/ncm/controller');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const verbose = process.argv.includes('--verbose');
const [cmd = 'status', arg] = args;

const controller = new NcmController({
  port: Number(process.env.NCM_DEBUG_PORT) || 9222,
  exePath: process.env.NCM_PATH || null,
});
controller.on('log', ({ level, message }) => (verbose || level !== 'info') && console.error(`[${level}] ${message}`));

const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const summary = (s) => {
  const t = s.track;
  if (!t) return `[${s.connection.status}] 当前无播放`;
  const pos = s.progress.position + (s.playing ? (Date.now() - s.progress.at) / 1000 : 0);
  return `${s.playing ? '▶' : '⏸'} ${t.name} - ${t.artists.map((a) => a.name).join('/')} | ${fmt(pos)} / ${fmt(t.duration)} | ${s.liked ? '♥ 已喜欢' : '♡ 未喜欢'} | 模式 ${s.playingMode} | 歌词 ${s.lyric.status}(${s.lyric.lines.length})`;
};
const currentLine = (s) => {
  const pos = s.progress.position + (s.playing ? (Date.now() - s.progress.at) / 1000 : 0);
  const lines = s.lyric.lines;
  let i = -1;
  while (i + 1 < lines.length && lines[i + 1].time <= pos) i++;
  return i >= 0 ? `[${fmt(lines[i].time)}] ${lines[i].text}${lines[i].translation ? ' / ' + lines[i].translation : ''}` : '';
};

function waitConnected(timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`连接超时：${controller.getState().connection.message}`)), timeoutMs);
    const check = (s) => {
      if (s.connection.status !== 'connected') return;
      clearTimeout(timer);
      controller.off('state', check);
      setTimeout(resolve, 500);
    };
    controller.on('state', check);
  });
}

(async () => {
  controller.start();
  await waitConnected();
  const s = controller.getState();

  if (cmd === 'watch') {
    let lastSummary = '';
    let lastLine = '';
    controller.on('state', (st) => {
      const line = summary(st);
      if (line !== lastSummary) console.log((lastSummary = line));
    });
    setInterval(() => {
      const st = controller.getState();
      const line = currentLine(st);
      if (line && line !== lastLine) console.log('   ♪', (lastLine = line));
    }, 200);
    console.log(summary(s));
    return;
  }

  if (cmd === 'status') {
    console.log(summary(s));
    console.log('   ♪', currentLine(s) || '(无)');
  } else if (cmd === 'lyric') {
    console.log(summary(s));
    for (const l of s.lyric.lines) console.log(`[${fmt(l.time)}] ${l.text}${l.translation ? ' / ' + l.translation : ''}`);
  } else if (COMMANDS.has(cmd)) {
    console.log('before:', summary(s));
    const res = await controller.command(cmd, arg);
    console.log('result:', res.ok ? 'ok' : `失败 - ${res.message}`);
    await new Promise((r) => setTimeout(r, 1500));
    console.log('after: ', summary(controller.getState()));
  } else {
    throw new Error(`未知命令: ${cmd}`);
  }
  await controller.stop();
  process.exit(0);
})().catch(async (err) => {
  console.error('Error:', err.message);
  await controller.stop();
  process.exit(1);
});
