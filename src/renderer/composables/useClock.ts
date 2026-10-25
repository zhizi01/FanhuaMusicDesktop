import { computed, ref } from 'vue';

const WEEKDAYS = '日一二三四五六';
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | undefined;

const pad = (n: number) => String(n).padStart(2, '0');

export function useClock() {
  timer ??= setInterval(() => (now.value = new Date()), 1000);
  const time = computed(() => `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}`);
  const seconds = computed(() => pad(now.value.getSeconds()));
  const date = computed(() => `${now.value.getMonth() + 1}月${now.value.getDate()}日 星期${WEEKDAYS[now.value.getDay()]}`);
  return { time, seconds, date };
}
