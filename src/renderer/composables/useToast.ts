import { ref } from 'vue';

const message = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;

export function useToast() {
  function show(text: string, durationMs = 2500) {
    message.value = text;
    clearTimeout(timer);
    timer = setTimeout(() => (message.value = ''), durationMs);
  }
  return { message, show };
}
