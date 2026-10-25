<script setup lang="ts">
const model = defineModel<boolean>({ required: true });
defineProps<{ disabled?: boolean }>();
</script>

<template>
  <button type="button" role="switch" class="switch" :class="{ on: model }" :aria-checked="model" :disabled="disabled" @click="model = !model">
    <span class="knob" />
  </button>
</template>

<style scoped>
.switch {
  position: relative;
  flex: none;
  width: 40px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: background 0.2s ease;
}
.switch.on {
  background: var(--accent);
}
.switch:disabled {
  opacity: 0.4;
  cursor: default;
}
.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}
.on .knob {
  transform: translateX(18px);
}
</style>
