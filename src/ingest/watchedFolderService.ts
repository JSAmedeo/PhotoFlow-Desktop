import { join } from '@tauri-apps/api/path';
import { readDir, watch, type UnwatchFn } from '@tauri-apps/plugin-fs';
import { isTauriRuntime } from '../runtime/runtime';
import { autoImportWatchedFile, isSupportedWatchedImage } from './autoImportPipeline';
import type { StartWatcherOptions, WatchedFileCandidate } from './watchedFolderTypes';

let unwatchCurrent: UnwatchFn | null = null;
const inFlight = new Set<string>();
const recentlyHandled = new Set<string>();

function filenameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

async function stopCurrentWatcher(): Promise<void> {
  if (!unwatchCurrent) return;
  try {
    unwatchCurrent();
  } finally {
    unwatchCurrent = null;
    inFlight.clear();
  }
}

async function processCandidate(candidate: WatchedFileCandidate, options: StartWatcherOptions): Promise<void> {
  if (inFlight.has(candidate.path)) return;
  if (recentlyHandled.has(candidate.path)) return;

  inFlight.add(candidate.path);
  options.onStatus({ status: 'importing', lastDetected: candidate.filename });

  try {
    const result = await autoImportWatchedFile(
      candidate,
      options.sessionId,
      options.settings.fileSettleDelayMs,
    );
    recentlyHandled.add(candidate.path);
    window.setTimeout(() => recentlyHandled.delete(candidate.path), 10_000);
    options.onStatus({
      status: options.settings.watchEnabled ? 'watching' : 'off',
      lastDetected: candidate.filename,
      lastImport: `${candidate.filename}: ${result}`,
    });
    await options.onImported();
  } catch (error) {
    console.error('[PhotoFlow] Watched-folder import failed.', error);
    options.onStatus({
      status: 'error',
      lastDetected: candidate.filename,
      error: describeError(error, 'Watched-folder import failed.'),
    });
  } finally {
    inFlight.delete(candidate.path);
  }
}

async function scanExistingFiles(folderPath: string, options: StartWatcherOptions): Promise<void> {
  try {
    const entries = await readDir(folderPath);
    for (const entry of entries) {
      if (!entry.isFile || !isSupportedWatchedImage(entry.name)) continue;
      const path = await join(folderPath, entry.name);
      await processCandidate({
        path,
        filename: entry.name,
        detectedAt: new Date().toISOString(),
      }, options);
    }
  } catch (error) {
    console.error('[PhotoFlow] Could not scan watched folder.', error);
    options.onStatus({
      status: 'error',
      error: describeError(error, 'Could not scan watched folder.'),
    });
  }
}

export async function startWatchedFolder(options: StartWatcherOptions): Promise<void> {
  await stopCurrentWatcher();

  if (!isTauriRuntime()) {
    options.onStatus({ status: 'desktop-only' });
    return;
  }

  if (!options.settings.watchEnabled) {
    options.onStatus({ status: 'off' });
    return;
  }

  if (!options.settings.watchedImportFolder) {
    options.onStatus({ status: 'error', error: 'Choose a watched folder before enabling the watcher.' });
    return;
  }

  try {
    unwatchCurrent = await watch(
      options.settings.watchedImportFolder,
      event => {
        for (const path of event.paths) {
          const filename = filenameFromPath(path);
          if (!isSupportedWatchedImage(filename)) continue;
          void processCandidate({
            path,
            filename,
            detectedAt: new Date().toISOString(),
          }, options);
        }
      },
      { delayMs: Math.max(250, options.settings.fileSettleDelayMs), recursive: false },
    );
    options.onStatus({ status: 'watching' });
    void scanExistingFiles(options.settings.watchedImportFolder, options);
  } catch (error) {
    console.error('[PhotoFlow] Could not start watched-folder ingest.', error);
    options.onStatus({
      status: 'error',
      error: describeError(error, 'Could not start watched-folder ingest.'),
    });
  }
}

export async function stopWatchedFolder(): Promise<void> {
  await stopCurrentWatcher();
}
