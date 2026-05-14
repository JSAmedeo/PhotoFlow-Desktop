import { getRuntimeMode } from '../../runtime/runtime';
import { browserMetadataStore } from './browserMetadataStore';
import type { MetadataStore } from './metadataStore';

let storePromise: Promise<MetadataStore> | null = null;

export async function getMetadataStore(): Promise<MetadataStore> {
  if (!storePromise) {
    storePromise = getRuntimeMode() === 'tauri'
      ? import('./sqliteMetadataStore').then(module => module.sqliteMetadataStore)
      : Promise.resolve(browserMetadataStore);
  }

  return storePromise;
}

export async function initializeMetadataStore(): Promise<MetadataStore> {
  const store = await getMetadataStore();
  await store.initialize();
  return store;
}
