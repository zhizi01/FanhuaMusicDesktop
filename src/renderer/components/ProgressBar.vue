<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatTime } from '../utils/format';

const props = defineProps<{ position: number; duration: number; disabled?: boolean }>();
const emit = defineEmits<{ seek: [seconds: number] }>();

const bar = ref<HTMLElement>();
/** Fraction (0..1) while dragging; null otherwise. */
const drag = ref<number | null>(null);
const shown = computed(() => (drag.value !== null ? drag.value * props.duration : props.position));
const percent = computed(() => (props.duration ? Math.min(100, (shown.value / props.duration) * 100) : 0));

function fraction(e: PointerEvent) {
  const r = bar.value!.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
}
function onDown(e: PointerEvent) {
  if (props.disabled || !props.duration) return;
  bar.value!.setPointerCapture(e.pointerId);
  drag.value = fraction(e);
}
function onMove(e: PointerEvent) {
  if (drag.value !== null) drag.value = fraction(e);
}
function onUp(e: PointerEvent) {
  if (drag.value === null) return;
  const seconds = fraction(e) * props.duration;
  drag.value = null;
  emit('seek', seconds);
}
</script>

<template>
  <div class="progress" :class="{ disabled }">
    <div
      ref="bar"
      class="bar"
      :class="{ dragging: drag !== null }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="drag = null"
    >
      <div class="track"><div class="fill" :style="{ width: `${percent}%` }" /></div>
      <div class="thumb" :style="{ left: `${percent}%` }" />
    </div>
    <div class="times">
      <span>{{ formatTime(shown) }}</span>
      <span>{{ formatTime(duration) }}</span>
    </div>
  </div>
</template>

<style scoped>
.bar {
  position: relative;
  height: 18px;
  cursor: pointer;
  touch-action: none;
}
.disabled .bar {
  cursor: default;
}
.track {
  position: absolute;
  top: 7px;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.16);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-a), var(--fg));
}
.thumb {
  position: absolute;
  top: 3px;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.bar:hover .thumb,
.bar.dragging .thumb {
  opacity: 1;
}
.disabled .thumb {
  display: none;
}
.times {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--fg-2);
  font-variant-numeric: tabular-nums;
}
</style>
