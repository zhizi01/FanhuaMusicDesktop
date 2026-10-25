import { onBeforeUnmount, onMounted, ref } from 'vue';

const EVENTS = ['mousemove', 'mousedown', 'wheel', 'keydown', 'touchstart'] as const;

/** `active` is true while the user interacted within the last `timeoutMs`. */
export function useIdle(timeoutMs: number) {
  const active = ref(true);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastX = -1;
  let lastY = -1;

  function poke() {
    active.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => (active.value = false), timeoutMs);
  }

  function onEvent(e: Event) {
    if (e instanceof MouseEvent && e.type === 'mousemove') {
      // Chromium emits synthetic mousemoves when content changes under a still cursor; require real movement.
      if (Math.abs(e.screenX - lastX) < 3 && Math.abs(e.screenY - lastY) < 3) return;
      lastX = e.screenX;
      lastY = e.screenY;
    }
    poke();
  }

  onMounted(() => {
    EVENTS.forEach((name) => window.addEventListener(name, onEvent, { passive: true }));
    poke();
  });
  onBeforeUnmount(() => {
    EVENTS.forEach((name) => window.removeEventListener(name, onEvent));
    clearTimeout(timer);
  });

  return { active, poke };
}
