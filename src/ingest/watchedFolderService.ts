import type { UnwatchFn } from '@tauri-apps/plugin-fs';
import { isTauriRuntime } from '../runtime/runtime';
import { autoImportWatchedFile } from './autoImportPipeline';
import type { StartImageStreamWatchersOptions, StartWatcherOptions, WatchedFileCandidate } from './watchedFolderTypes';

// OS-generated files that should never surface in the import queue.
const SYSTEM_JUNK_FILENAMES = new Set([
  'thumbs.db', 'desktop.ini', 'picasa.ini', '.ds_store', '.localized',
]);
function isSystemJunkFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SYSTEM_JUNK_FILENAMES.has(lower) || lower.startsWith('.') || lower.startsWith('~');
}

let unwatchCurrent: UnwatchFn | null = null;
const streamUnwatchers = new Map<string, UnwatchFn>();
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

async function stopStreamWatchers(): Promise<void> {
  for (const unwatch of streamUnwatchers.values()) {
    try {
      unwatch();
    } catch {
      // Keep stopping the rest of the active watchers.
    }
  }
  streamUnwatchers.clear();
  inFlight.clear();
}

async function processCandidate(candidate: WatchedFileCandidate, options: StartWatcherOptions): Promise<void> {
  if (inFlight.has(candidate.path)) return;
  if (recentlyHandled.has(candidate.path)) return;

  inFlight.add(candidate.path);
  options.onStatus({ status: 'importing', lastDetected: candidate.filename });
  if (options.imageStream) options.onStreamStatus?.(options.imageStream.id, { status: 'importing', lastDetected: candidate.filename });

  try {
    const result = await autoImportWatchedFile(
      candidate,
      options.sessionId,
      options.settings.fileSettleDelayMs,
      options.imageStream,
    );
    // Always guard the path: 5 s for complete imports (covers the deletion-event window
    // and any scanExistingFiles run on watcher restart before the file is removed);
    // 10 s for failed/skipped so a retry doesn't fire immediately.
    recentlyHandled.add(candidate.path);
    window.setTimeout(() => recentlyHandled.delete(candidate.path), result === 'complete' ? 5_000 : 10_000);
    options.onStatus({
      status: options.settings.watchEnabled ? 'watching' : 'off',
      lastDetected: candidate.filename,
      lastImport: `${candidate.filename}: ${result}`,
    });
    if (options.imageStream) {
      options.onStreamStatus?.(options.imageStream.id, {
        status: result === 'failed' ? 'error' : 'watching',
        lastDetected: candidate.filename,
        lastImport: `${candidate.filename}: ${result}`,
      });
    }
    await options.onImported();
  } catch (error) {
    console.error('[PhotoFlow] Watched-folder import failed.', error);
    options.onStatus({
      status: 'error',
      lastDetected: candidate.filename,
      error: describeError(error, 'Watched-folder import failed.'),
    });
    if (options.imageStream) {
      options.onStreamStatus?.(options.imageStream.id, {
        status: 'error',
        lastDetected: candidate.filename,
        error: describeError(error, 'Watched-folder import failed.'),
      });
    }
  } finally {
    inFlight.delete(candidate.path);
  }
}

// Dynamic imports are used here (rather than top-level) so the browser bundle
// never attempts to resolve @tauri-apps modules. This function is only reached
// after the isTauriRuntime() guard in its callers.
async function scanExistingFiles(folderPath: string, options: StartWatcherOptions): Promise<void> {
  try {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');
    const entries = await readDir(folderPath);
    for (const entry of entries) {
      if (!entry.isFile || isSystemJunkFile(entry.name)) continue;
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
  await stopStreamWatchers();

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

  const { watch } = await import('@tauri-apps/plugin-fs');

  try {
    unwatchCurrent = await watch(
      options.settings.watchedImportFolder,
      event => {
        for (const path of event.paths) {
          const filename = filenameFromPath(path);
          if (isSystemJunkFile(filename)) continue;
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
  await stopStreamWatchers();
}

export async function startImageStreamWatchers(options: StartImageStreamWatchersOptions): Promise<void> {
  await stopCurrentWatcher();
  await stopStreamWatchers();

  if (!isTauriRuntime()) {
    options.onStatus({ status: 'desktop-only' });
    return;
  }

  const activeStreams = options.streams.filter(stream => stream.type === 'local-folder' && stream.enabled);
  if (activeStreams.length === 0) {
    options.onStatus({ status: 'off' });
    return;
  }

  const { watch } = await import('@tauri-apps/plugin-fs');

  let started = 0;
  for (const stream of activeStreams) {
    if (!stream.watchPath) {
      options.onStreamStatus(stream.id, { status: 'error', error: 'Choose a watched folder before enabling this stream.' });
      continue;
    }

    const streamOptions: StartWatcherOptions = {
      settings: {
        watchEnabled: stream.enabled,
        watchedImportFolder: stream.watchPath,
        fileSettleDelayMs: options.settleDelayMs,
        defaultCaptureLocationId: stream.captureLocationId ?? stream.id,
        defaultSessionAssignmentMode: 'active-session',
      },
      imageStream: stream,
      sessionId: options.sessionId,
      onStatus: options.onStatus,
      onStreamStatus: options.onStreamStatus,
      onImported: options.onImported,
    };

    try {
      const unwatch = await watch(
        stream.watchPath,
        event => {
          for (const path of event.paths) {
            const filename = filenameFromPath(path);
            if (isSystemJunkFile(filename)) continue;
            void processCandidate({
              path,
              filename,
              imageStreamId: stream.id,
              detectedAt: new Date().toISOString(),
            }, streamOptions);
          }
        },
        { delayMs: Math.max(250, options.settleDelayMs), recursive: false },
      );
      streamUnwatchers.set(stream.id, unwatch);
      options.onStreamStatus(stream.id, { status: 'watching' });
      started += 1;
      void scanExistingFiles(stream.watchPath, streamOptions);
    } catch (error) {
      console.error('[PhotoFlow] Could not start image stream watcher.', error);
      options.onStreamStatus(stream.id, {
        status: 'error',
        error: describeError(error, 'Could not start image stream watcher.'),
      });
    }
  }

  options.onStatus({ status: started > 0 ? 'watching' : 'error' });
}
