import { ref } from 'vue';
import type { Settings, SettingsPatch, SettingsResult } from '../types';

const settings = ref<Settings | null>(null);
let loaded = false;

const reload = async () => (settings.value = await window.desktop.settings.get());

async function apply(request: Promise<SettingsResult>): Promise<SettingsResult> {
  const res = await request;
  if (res.ok && res.settings) settings.value = res.settings;
  return res;
}

export function useSettings() {
  if (!loaded) {
    loaded = true;
    reload();
  }
  return {
    settings,
    reload,
    update: (patch: SettingsPatch) => apply(window.desktop.settings.update(patch)),
    setPassword: (password: string) => apply(window.desktop.settings.setPassword(password)),
    clearPassword: () => apply(window.desktop.settings.clearPassword()),
  };
}
