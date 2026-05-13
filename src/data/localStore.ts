// Raw localStorage helpers for PhotoFlow Desktop.
// All app keys are prefixed with "pf_" to avoid collisions.
// Only this file reads from or writes to localStorage directly.
// All other code goes through repository.ts.

const PREFIX = 'pf_';

function key(name: string): string {
  return `${PREFIX}${name}`;
}

export function storeGet<T>(name: string): T | null {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function storeSet<T>(name: string, value: T): boolean {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
    return true;
  } catch {
    console.warn(`[PhotoFlow] Failed to write localStorage key: ${name}`);
    return false;
  }
}

export function storeRemove(name: string): void {
  localStorage.removeItem(key(name));
}

// Clears every key that belongs to this app (anything starting with "pf_").
export function storeClearAll(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}

// Named store keys used by the app
export const STORE_KEYS = {
  sessions:          'sessions',
  photos:            'photos',
  locations:         'locations',
  hours:             'hours',
  selectedSessionId: 'selectedSessionId',
  selectedPhotoId:   'selectedPhotoId',
  activeTab:         'activeTab',
  selectedHour:      'selectedHour',
  importQueue:       'importQueue',
} as const;
