<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { message } = useToast();
</script>

<template>
  <Transition name="fade">
    <div v-if="message" class="toast" role="status">{{ message }}</div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 128px;
  z-index: 300;
  transform: translateX(-50%);
  max-width: 82%;
  padding: 9px 16px;
  border-radius: 10px;
  background: rgba(20, 20, 26, 0.92);
  border: 1px solid var(--border);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  font-size: 13px;
  text-align: center;
}
</style>
