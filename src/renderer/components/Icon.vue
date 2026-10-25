<script setup lang="ts">
import { ICONS, type IconName } from './icons';

withDefaults(defineProps<{ name: IconName; size?: number; filled?: boolean }>(), { size: 20, filled: false });
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="ICONS[name]"
  />
</template>

<style scoped>
.icon {
  display: block;
  flex: none;
}
</style>
