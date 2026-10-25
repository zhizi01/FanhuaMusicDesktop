<script setup lang="ts">
withDefaults(defineProps<{ src: string; dim?: number; blur?: number }>(), { dim: 0.5, blur: 48 });
</script>

<template>
  <div class="backdrop">
    <Transition name="xfade">
      <div
        :key="src"
        class="layer"
        :style="{ backgroundImage: src ? `url(&quot;${src}&quot;)` : 'none', filter: `blur(${blur}px) saturate(1.4)` }"
      />
    </Transition>
    <div class="shade" :style="{ opacity: dim }" />
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: radial-gradient(120% 80% at 20% 0%, #2a1f2e 0%, #15131c 55%, #0e0e13 100%);
}
.layer {
  position: absolute;
  inset: -12%;
  background: center / cover no-repeat;
}
.shade {
  position: absolute;
  inset: 0;
  background: #000;
}
.xfade-enter-active,
.xfade-leave-active {
  transition: opacity 0.8s ease;
}
.xfade-enter-from,
.xfade-leave-to {
  opacity: 0;
}
</style>
