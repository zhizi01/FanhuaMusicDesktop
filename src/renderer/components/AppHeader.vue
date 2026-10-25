<script setup lang="ts">
import { computed } from 'vue';
import { useNcm } from '../composables/useNcm';
import type { ConnectionStatus } from '../types';
import IconButton from './IconButton.vue';

const emit = defineEmits<{ screensaver: []; settings: [] }>();
const { connection, busy } = useNcm();
const minimize = () => window.desktop.minimize();
const close = () => window.desktop.close();

const LABELS: Record<ConnectionStatus, string> = {
  idle: '初始化',
  launching: '启动中',
  restarting: '重启中',
  connecting: '连接中',
  connected: '已连接',
  disconnected: '已断开',
  waiting: '未运行',
  'need-restart': '需重启',
  error: '连接错误',
};

const tone = computed(() => {
  const s = connection.value.status;
  if (s === 'connected') return 'ok';
  if (busy.value) return 'busy';
  return s === 'error' || s === 'disconnected' || s === 'need-restart' ? 'bad' : 'idle';
});
</script>

<template>
  <header class="app-header">
    <h1 class="brand">繁花GG</h1>
    <div class="right">
      <div class="status" :class="tone" :title="connection.message">
        <span class="dot" />
        <span>{{ LABELS[connection.status] }}</span>
      </div>
      <IconButton icon="screensaver" title="屏保模式" @click="emit('screensaver')" />
      <IconButton icon="settings" title="设置" @click="emit('settings')" />
      <span class="sep" />
      <IconButton icon="minimize" size="sm" title="最小化" @click="minimize" />
      <IconButton icon="close" size="sm" variant="danger" title="关闭" @click="close" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 10px 0 18px;
  -webkit-app-region: drag;
}
.brand {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  background: linear-gradient(90deg, var(--brand-a), var(--brand-b));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.status {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  margin-right: 4px;
  padding: 0 10px 0 8px;
  border-radius: 12px;
  background: var(--glass);
  font-size: 12px;
  color: var(--fg-2);
  cursor: default;
  -webkit-app-region: no-drag;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8a8a93;
}
.ok .dot {
  background: var(--ok);
  box-shadow: 0 0 8px var(--ok);
}
.busy .dot {
  background: var(--warn);
  animation: pulse 1s ease-in-out infinite;
}
.bad .dot {
  background: var(--bad);
}
.sep {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--border);
}
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}
</style>
