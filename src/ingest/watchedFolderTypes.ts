import type { WatcherRuntimeState, WatchedFolderSettings } from '../data/models';

export const SUPPORTED_WATCHED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export interface WatchedFileCandidate {
  path: string;
  filename: string;
  detectedAt: string;
}

export interface StartWatcherOptions {
  settings: WatchedFolderSettings;
  sessionId: string;
  onStatus: (state: WatcherRuntimeState) => void;
  onImported: () => Promise<void>;
}
