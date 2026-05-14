import { isTauri } from '@tauri-apps/api/core';

export type RuntimeMode = 'browser' | 'tauri';

export function isTauriRuntime(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

export function getRuntimeMode(): RuntimeMode {
  return isTauriRuntime() ? 'tauri' : 'browser';
}
