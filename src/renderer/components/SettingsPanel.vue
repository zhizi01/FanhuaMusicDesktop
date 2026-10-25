<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useNcm } from '../composables/useNcm';
import { useSettings } from '../composables/useSettings';
import { useToast } from '../composables/useToast';
import type { ScreensaverPreset, SettingsResult } from '../types';
import Icon from './Icon.vue';
import IconButton from './IconButton.vue';
import ToggleSwitch from './ToggleSwitch.vue';
import { PRESET_INFO } from './screensaver/presets';

const open = defineModel<boolean>('open', { required: true });
const { settings, update, setPassword, clearPassword } = useSettings();
const { connection } = useNcm();
const { show } = useToast();

const ss = computed(() => settings.value?.screensaver);
const editingPassword = ref(false);
const password = ref('');
const confirm = ref('');
const error = ref('');

watch(open, (v) => !v && resetPasswordForm());

function resetPasswordForm() {
  editingPassword.value = false;
  password.value = '';
  confirm.value = '';
  error.value = '';
}

async function run(request: Promise<SettingsResult>, success?: string) {
  const res = await request;
  if (!res.ok) show(res.message || '保存失败');
  else if (success) show(success);
  return res;
}

const choosePreset = (preset: ScreensaverPreset) => run(update({ screensaver: { preset } }));
const setTranslation = (showTranslation: boolean) => run(update({ screensaver: { showTranslation } }));

function setLock(enabled: boolean) {
  if (enabled && !ss.value?.hasPassword) {
    editingPassword.value = true;
    return;
  }
  run(update({ screensaver: { lockEnabled: enabled } }), enabled ? '已开启屏保密码锁' : '已关闭屏保密码锁');
}

async function savePassword() {
  error.value = '';
  if (password.value.length < 4) return (error.value = '密码至少 4 位');
  if (password.value !== confirm.value) return (error.value = '两次输入的密码不一致');
  const res = await setPassword(password.value);
  if (!res.ok) return (error.value = res.message || '保存失败');
  resetPasswordForm();
  show('解锁密码已保存，屏保密码锁已开启');
}

async function removePassword() {
  await run(clearPassword(), '已清除密码并关闭屏保密码锁');
  resetPasswordForm();
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="mask" @click.self="open = false">
      <aside class="panel">
        <header class="panel-header">
          <h2>设置</h2>
          <IconButton icon="close" size="sm" title="关闭" @click="open = false" />
        </header>

        <div v-if="ss" class="body">
          <section>
            <h3>屏保样式</h3>
            <div class="presets">
              <button
                v-for="id in ss.presets"
                :key="id"
                type="button"
                class="preset"
                :class="{ selected: ss.preset === id }"
                @click="choosePreset(id)"
              >
                <span class="preview" :class="id"><Icon :name="PRESET_INFO[id].icon" :size="22" /></span>
                <strong>{{ PRESET_INFO[id].name }}</strong>
                <small>{{ PRESET_INFO[id].desc }}</small>
              </button>
            </div>
            <div class="row">
              <div class="label"><span>屏保中显示歌词翻译</span></div>
              <ToggleSwitch :model-value="ss.showTranslation" @update:model-value="setTranslation" />
            </div>
          </section>

          <section>
            <h3>屏保密码锁</h3>
            <div class="row">
              <div class="label">
                <span>退出屏保需要输入密码</span>
                <small>关闭时，移动鼠标点击“退出屏保”或按 Esc 即可退出</small>
              </div>
              <ToggleSwitch :model-value="ss.lockEnabled" @update:model-value="setLock" />
            </div>

            <form v-if="editingPassword" class="password-form" @submit.prevent="savePassword">
              <input v-model="password" class="text-input" type="password" placeholder="新密码（4-64 位）" autocomplete="new-password" />
              <input v-model="confirm" class="text-input" type="password" placeholder="再次输入密码" autocomplete="new-password" />
              <p v-if="error" class="error">{{ error }}</p>
              <div class="actions">
                <button type="button" class="btn" @click="resetPasswordForm">取消</button>
                <button type="submit" class="btn primary">保存密码</button>
              </div>
            </form>
            <div v-else-if="ss.hasPassword" class="actions">
              <button type="button" class="btn" @click="editingPassword = true">修改密码</button>
              <button type="button" class="btn danger" @click="removePassword">清除密码</button>
            </div>
            <p class="note">提示：此为应用级锁，无法拦截 Ctrl+Alt+Del、Win+L 等系统快捷键。</p>
          </section>

          <section>
            <h3>关于</h3>
            <p class="about">繁花GG · 网易云音乐桌面控制</p>
            <p class="about">连接状态：{{ connection.message }}</p>
          </section>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.45);
}
.panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(100%, 400px);
  display: flex;
  flex-direction: column;
  background: rgba(22, 21, 28, 0.97);
  border-left: 1px solid var(--border);
  box-shadow: -20px 0 50px rgba(0, 0, 0, 0.4);
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 10px 0 20px;
  flex: none;
  -webkit-app-region: drag;
}
.panel-header h2 {
  font-size: 16px;
  font-weight: 600;
}
.body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 24px;
}
section + section {
  margin-top: 26px;
}
h3 {
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--fg-3);
}
.presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.preset {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--glass);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.preset:hover {
  background: var(--glass-strong);
}
.preset.selected {
  border-color: var(--accent);
}
.preview {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 16 / 10;
  margin-bottom: 4px;
  border-radius: 8px;
  color: #fff;
}
.preview.lyrics {
  background: linear-gradient(135deg, #6a3d5a, #2b2340);
}
.preview.vinyl {
  background: radial-gradient(circle, #3a3a44 0 30%, #111 31% 100%);
}
.preview.clock {
  background: linear-gradient(135deg, #1d2b3a, #0d0f16);
}
.preset strong {
  font-size: 13px;
}
.preset small {
  font-size: 11px;
  line-height: 1.35;
  color: var(--fg-3);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}
.label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 14px;
}
.label small {
  font-size: 11.5px;
  color: var(--fg-3);
}
.password-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.password-form .actions {
  margin-top: 0;
}
.error {
  font-size: 12.5px;
  color: var(--bad);
}
.note {
  margin-top: 14px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--fg-3);
}
.about {
  font-size: 13px;
  line-height: 1.7;
  color: var(--fg-2);
}
.sheet-enter-active,
.sheet-leave-active {
  transition: background 0.25s ease;
}
.sheet-enter-active .panel,
.sheet-leave-active .panel {
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  background: transparent;
}
.sheet-enter-from .panel,
.sheet-leave-to .panel {
  transform: translateX(100%);
}
</style>
