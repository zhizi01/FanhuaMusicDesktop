import { ref } from 'vue';
import type { ScreensaverState } from '../types';

// The source of truth lives in the main process (survives renderer reloads, enforces the lock).
const state = ref<ScreensaverState>({ active: false, locked: false });
let initialized = false;

export function useScreensaver() {
  if (!initialized) {
    initialized = true;
    window.desktop.screensaver.onChange((s) => (state.value = s));
    window.desktop.screensaver.getState().then((s) => (state.value = s));
  }
  return {
    state,
    enter: async () => (state.value = await window.desktop.screensaver.enter()),
    exit: (password?: string) => window.desktop.screensaver.exit(password),
  };
}
