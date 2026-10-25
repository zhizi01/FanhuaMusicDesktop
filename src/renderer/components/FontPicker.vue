<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import Icon from './Icon.vue';

/** Selected font family; '' = default font stack. */
const model = defineModel<string>({ required: true });

// Shown first when installed (localized and English names, Chinese-friendly fonts).
const RECOMMENDED = [
  '微软雅黑', 'Microsoft YaHei UI', '等线', '黑体', '宋体', '楷体', '仿宋', '思源黑体 CN Regular',
  'Noto Sans SC', 'Noto Serif SC', 'HarmonyOS Sans SC', 'MiSans', '霞鹜文楷', 'LXGW WenKai', '阿里巴巴普惠体', 'Segoe UI',
];
const SAMPLE = '繁花似锦 Aa 123';

const open = ref(false);
const query = ref('');
const fonts = ref<string[] | null>(null);
const search = ref<HTMLInputElement>();

const recommended = computed(() => RECOMMENDED.filter((f) => fonts.value?.includes(f)));
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = fonts.value ?? [];
  return q ? list.filter((f) => f.toLowerCase().includes(q)) : list;
});

const fontStyle = (family: string) => (family ? { fontFamily: `"${family}", var(--font-default)` } : undefined);

async function toggle() {
  open.value = !open.value;
  if (!open.value) return;
  nextTick(() => search.value?.focus());
  fonts.value ??= await window.desktop.fonts.list();
}

function pick(family: string) {
  model.value = family;
  open.value = false;
  query.value = '';
}
</script>

<template>
  <div class="font-picker">
    <button type="button" class="current" :class="{ open }" @click="toggle">
      <span :style="fontStyle(model)">{{ model || '默认字体' }}</span>
      <Icon name="chevron" :size="16" />
    </button>

    <div v-if="open" class="dropdown">
      <label class="search">
        <Icon name="search" :size="15" />
        <input ref="search" v-model="query" placeholder="搜索字体名称" @keydown.esc="open = false" />
      </label>
      <div class="list">
        <p v-if="!fonts" class="hint">正在读取系统字体...</p>
        <template v-else>
          <button v-if="!query" type="button" class="item" :class="{ selected: !model }" @click="pick('')">
            <span>默认字体</span><small>{{ SAMPLE }}</small>
          </button>
          <template v-if="!query && recommended.length">
            <p class="group">推荐</p>
            <button
              v-for="f in recommended"
              :key="`r-${f}`"
              type="button"
              class="item"
              :class="{ selected: f === model }"
              :style="fontStyle(f)"
              @click="pick(f)"
            >
              <span>{{ f }}</span><small>{{ SAMPLE }}</small>
            </button>
          </template>
          <p class="group">{{ query ? `搜索结果（${filtered.length}）` : `全部字体（${filtered.length}）` }}</p>
          <button
            v-for="f in filtered"
            :key="f"
            type="button"
            class="item"
            :class="{ selected: f === model }"
            :style="fontStyle(f)"
            @click="pick(f)"
          >
            <span>{{ f }}</span><small>{{ SAMPLE }}</small>
          </button>
          <p v-if="!filtered.length" class="hint">没有匹配的字体</p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-picker {
  margin-top: 10px;
}
.current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.25);
  cursor: pointer;
  font-size: 14px;
}
.current span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.current :deep(.icon) {
  color: var(--fg-3);
  transition: transform 0.2s ease;
}
.current.open :deep(.icon) {
  transform: rotate(180deg);
}
.dropdown {
  margin-top: 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  color: var(--fg-3);
}
.search input {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--fg);
}
.list {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
}
.group {
  padding: 8px 8px 4px;
  font-size: 11px;
  color: var(--fg-3);
}
.item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.item:hover {
  background: var(--glass-strong);
}
.item.selected {
  background: rgba(255, 77, 109, 0.18);
}
.item span {
  font-size: 14px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.item small {
  flex: none;
  font-size: 12px;
  color: var(--fg-3);
}
.hint {
  padding: 12px 8px;
  font-size: 12.5px;
  color: var(--fg-3);
  text-align: center;
}
</style>
