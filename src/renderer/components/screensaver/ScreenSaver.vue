<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useIdle } from '../../composables/useIdle';
import { useScreensaver } from '../../composables/useScreensaver';
import { useSettings } from '../../composables/useSettings';
import Icon from '../Icon.vue';
import ClockSaver from './ClockSaver.vue';
import LyricsSaver from './LyricsSaver.vue';
import VinylSaver from './VinylSaver.vue';

/** The unlock / exit panel hides after this long without mouse or keyboard activity. */
const IDLE_MS = 10_000;
const PRESETS = { lyrics: LyricsSaver, vinyl: VinylSaver, clock: ClockSaver };

const { state, exit } = useScreensaver();
const { settings, reload } = useSettings();
reload(); // always use the persisted preset/options
const { active } = useIdle(IDLE_MS);

const preset = computed(() => PRESETS[settings.value?.screensaver.preset ?? 'lyrics']);
const showTranslation = computed(() => settings.value?.screensaver.showTranslation ?? true);

const input = ref<HTMLInputElement>();
const password = ref('');
const error = ref('');
const shaking = ref(false);
const submitting = ref(false);

watch(
  active,
  (visible) => {
    if (visible) nextTick(() => input.value?.focus());
    else {
      password.value = '';
      error.value = '';
    }
  },
  { immediate: true }
);

async function unlock() {
  if (submitting.value || !password.value) return;
  submitting.value = true;
  const res = await exit(password.value);
  submitting.value = false;
  if (res.ok) return;
  error.value = res.message || '解锁失败';
  password.value = '';
  shaking.value = true;
  setTimeout(() => (shaking.value = false), 450);
  nextTick(() => input.value?.focus());
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && !state.value.locked) exit();
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="saver" :class="{ 'hide-cursor': !active }">
    <component :is="preset" :show-translation="showTranslation" />

    <Transition name="fade">
      <div v-if="active" class="panel">
        <form v-if="state.locked" class="unlock" :class="{ shake: shaking }" @submit.prevent="unlock">
          <Icon name="lock" :size="18" />
          <input ref="input" v-model="password" type="password" placeholder="输入密码解锁" autocomplete="off" />
          <button type="submit" :disabled="submitting || !password">解锁</button>
        </form>
        <button v-else type="button" class="exit" @click="exit()">
          <Icon name="exit" :size="18" />
          <span>退出屏保</span>
        </button>
        <p class="hint" :class="{ error }">
          {{ error || (state.locked ? '10 秒无操作将自动隐藏，移动鼠标可再次显示' : '也可以按 Esc 退出') }}
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.saver {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #000;
}
.hide-cursor,
.hide-cursor * {
  cursor: none !important;
}
/* Sized in em so the panel scales with the screen (font-size follows vmin). */
.panel {
  position: absolute;
  left: 50%;
  bottom: 9vh;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8em;
  font-size: clamp(15px, 1.4vmin, 26px);
}
.unlock,
.exit {
  display: flex;
  align-items: center;
  gap: 0.65em;
  height: 3.5em;
  padding: 0 0.55em 0 1.2em;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 1.75em;
  background: rgba(16, 16, 22, 0.62);
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  color: var(--fg);
  font-size: 1em;
}
.unlock :deep(.icon),
.exit :deep(.icon) {
  width: 1.2em;
  height: 1.2em;
}
.unlock input {
  width: 15em;
  height: 2.4em;
  border: none;
  background: transparent;
  outline: none;
  font-size: 1em;
  letter-spacing: 0.15em;
}
.unlock input::placeholder {
  letter-spacing: 0;
  color: var(--fg-3);
}
.unlock button {
  height: 2.4em;
  padding: 0 1.2em;
  border: none;
  border-radius: 1.2em;
  background: var(--fg);
  color: #111;
  font-size: 0.93em;
  font-weight: 600;
  cursor: pointer;
}
.unlock button:disabled {
  opacity: 0.4;
  cursor: default;
}
.exit {
  padding: 0 1.5em;
  cursor: pointer;
  transition: background 0.15s ease;
}
.exit:hover {
  background: rgba(40, 40, 50, 0.8);
}
.hint {
  font-size: 0.83em;
  color: var(--fg-2);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
}
.hint.error {
  color: #ff8a8a;
}
.shake {
  animation: shake 0.45s ease;
}
@keyframes shake {
  20%,
  60% {
    transform: translateX(-8px);
  }
  40%,
  80% {
    transform: translateX(8px);
  }
}
</style>
