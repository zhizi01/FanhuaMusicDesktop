<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { LyricLine, LyricState } from '../types';

const props = withDefaults(
  defineProps<{ lines: LyricLine[]; index: number; status: LyricState['status']; hasTrack: boolean; showTranslation?: boolean }>(),
  { showTranslation: true }
);
const emit = defineEmits<{ seek: [time: number] }>();

const viewport = ref<HTMLElement>();
let manualScrollUntil = 0;

const message = computed(() => {
  if (!props.hasTrack) return '';
  return { loading: '歌词加载中...', failed: '歌词获取失败', none: '暂无歌词', ok: '暂无歌词' }[props.status];
});

function center(i: number, smooth = true) {
  const box = viewport.value;
  const el = box?.querySelector<HTMLElement>(`[data-i="${i}"]`);
  if (!box || !el || Date.now() < manualScrollUntil) return;
  box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: smooth ? 'smooth' : 'auto' });
}

watch(
  () => props.index,
  (i) => nextTick(() => center(i))
);
watch(
  () => props.lines,
  () =>
    nextTick(() => {
      if (viewport.value) viewport.value.scrollTop = 0;
      center(props.index, false);
    })
);
</script>

<template>
  <section ref="viewport" class="lyrics" @wheel.passive="manualScrollUntil = Date.now() + 3000">
    <div v-if="lines.length" class="inner">
      <p
        v-for="(line, i) in lines"
        :key="i"
        :data-i="i"
        class="line"
        :class="{ active: i === index }"
        @click="emit('seek', line.time)"
      >
        {{ line.text || '♪' }}
        <span v-if="showTranslation && line.translation" class="sub">{{ line.translation }}</span>
      </p>
    </div>
    <div v-else class="empty">{{ message }}</div>
  </section>
</template>

<style scoped>
.lyrics {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  mask-image: linear-gradient(transparent, #000 20%, #000 80%, transparent);
}
.inner {
  padding: 22vh 6px;
  text-align: center;
}
.line {
  padding: 7px 0;
  color: var(--fg-3);
  font-size: 15px;
  line-height: 1.45;
  cursor: pointer;
  transition: color 0.3s ease, transform 0.3s ease;
}
.line:hover {
  color: var(--fg-2);
}
.line.active {
  color: var(--fg);
  font-weight: 600;
  transform: scale(1.08);
}
.sub {
  display: block;
  margin-top: 2px;
  font-size: 12.5px;
  font-weight: 400;
}
.empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--fg-3);
  font-size: 14px;
}
</style>
