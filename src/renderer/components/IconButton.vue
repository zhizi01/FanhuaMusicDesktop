<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import type { IconName } from './icons';

type Size = 'sm' | 'md' | 'lg' | 'xl';
const ICON_SIZE: Record<Size, number> = { sm: 16, md: 18, lg: 22, xl: 28 };

const props = withDefaults(
  defineProps<{
    icon: IconName;
    title?: string;
    size?: Size;
    variant?: 'ghost' | 'solid' | 'danger';
    filled?: boolean;
    active?: boolean;
    spinning?: boolean;
    disabled?: boolean;
  }>(),
  { size: 'md', variant: 'ghost' }
);
const iconSize = computed(() => ICON_SIZE[props.size]);
</script>

<template>
  <button
    type="button"
    class="icon-btn"
    :class="[size, variant, { active, spinning }]"
    :title="title"
    :aria-label="title"
    :disabled="disabled"
  >
    <Icon :name="icon" :size="iconSize" :filled="filled" />
  </button>
</template>

<style scoped>
.icon-btn {
  display: grid;
  place-items: center;
  flex: none;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
  -webkit-app-region: no-drag;
}
.icon-btn:hover:not(:disabled) {
  background: var(--glass-strong);
}
.icon-btn:active:not(:disabled) {
  transform: scale(0.92);
}
.icon-btn:disabled {
  opacity: 0.32;
  cursor: default;
}
.sm {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.md {
  width: 32px;
  height: 32px;
  border-radius: 9px;
}
.lg {
  width: 46px;
  height: 46px;
}
.xl {
  width: 66px;
  height: 66px;
}
.solid {
  background: var(--fg);
  color: #111;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.solid:hover:not(:disabled) {
  background: #fff;
}
.danger:hover:not(:disabled) {
  background: #e81123;
  color: #fff;
}
.active {
  color: var(--accent);
}
.spinning :deep(.icon) {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
