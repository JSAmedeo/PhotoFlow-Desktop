import type { ImageStream, WatcherRuntimeState, WatchedFolderSettings } from '../data/models';

export const SUPPORTED_WATCHED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export interface WatchedFileCandidate {
  path: string;
  filename: string;
  detectedAt: string;
  imageStreamId?: string;
}

export interface StartWatcherOptions {
  settings: WatchedFolderSettings;
  imageStream?: ImageStream;
  sessionId: string;
  onStatus: (state: WatcherRuntimeState) => void;
  onStreamStatus?: (streamId: string, state: WatcherRuntimeState) => void;
  onImported: () => Promise<void>;
}

export interface StartImageStreamWatchersOptions {
  streams: ImageStream[];
  settleDelayMs: number;
  sessionId: string;
  onStatus: (state: WatcherRuntimeState) => void;
  onStreamStatus: (streamId: string, state: WatcherRuntimeState) => void;
  onImported: () => Promise<void>;
}
