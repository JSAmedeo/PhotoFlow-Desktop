import { isTauriRuntime } from '../runtime/runtime';

export async function confirmDestructive(message: string, title: string): Promise<boolean> {
  if (isTauriRuntime()) {
    const { ask } = await import('@tauri-apps/plugin-dialog');
    return ask(message, { title, kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' });
  }
  return window.confirm(`${title}\n\n${message}`);
}
