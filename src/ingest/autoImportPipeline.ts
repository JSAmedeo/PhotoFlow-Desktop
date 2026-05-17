import {
  addImportQueueItem,
  importWatchedPhotoToSession,
  recordImageStreamActivity,
  updateImportQueueItem,
} from '../data/repository';
import type { ImageStream, ImportQueueItem } from '../data/models';
import { SUPPORTED_WATCHED_EXTENSIONS, type WatchedFileCandidate } from './watchedFolderTypes';
import { waitForStableFile } from './fileStability';

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function mimeTypeFor(filename: string): string {
  const extension = extensionOf(filename);
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function makeQueueItem(candidate: WatchedFileCandidate, sessionId: string, status: ImportQueueItem['status'], imageStream?: ImageStream): ImportQueueItem {
  return {
    id: `iq-watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filename: candidate.filename,
    sessionId,
    status,
    progress: status === 'skipped' ? 100 : 0,
    sourceType: 'watched-folder',
    sourcePath: candidate.path,
    sourceFilename: candidate.filename,
    imageStreamId: imageStream?.id ?? candidate.imageStreamId ?? null,
    imageStreamName: imageStream?.name ?? null,
    streamType: imageStream?.type,
    detectedAt: candidate.detectedAt,
    createdAt: new Date().toISOString(),
    completedAt: status === 'skipped' ? new Date().toISOString() : undefined,
  };
}

export function isSupportedWatchedImage(filename: string): boolean {
  return SUPPORTED_WATCHED_EXTENSIONS.includes(extensionOf(filename) as typeof SUPPORTED_WATCHED_EXTENSIONS[number]);
}

export async function autoImportWatchedFile(
  candidate: WatchedFileCandidate,
  sessionId: string,
  settleDelayMs: number,
  imageStream?: ImageStream,
): Promise<'complete' | 'skipped' | 'failed'> {
  if (!isSupportedWatchedImage(candidate.filename)) {
    await addImportQueueItem({
      ...makeQueueItem(candidate, sessionId, 'skipped', imageStream),
      error: 'Unsupported watched-folder file type.',
    });
    await recordImageStreamActivity(imageStream?.id ?? candidate.imageStreamId, 'skipped', candidate.filename);
    return 'skipped';
  }

  const queueItem = makeQueueItem(candidate, sessionId, 'queued', imageStream);
  await addImportQueueItem(queueItem);
  await recordImageStreamActivity(imageStream?.id ?? candidate.imageStreamId, 'detected', candidate.filename);

  try {
    await updateImportQueueItem(queueItem.id, {
      status: 'stabilizing',
      progress: 10,
      error: 'Waiting for file to finish copying.',
    });
    const stable = await waitForStableFile(candidate.path, settleDelayMs);
    await updateImportQueueItem(queueItem.id, {
      status: 'importing',
      progress: 25,
      fileSize: stable.size,
      lastModified: stable.lastModified,
      error: undefined,
    });

    const { readFile } = await import('@tauri-apps/plugin-fs');
    const bytes = await readFile(candidate.path);
    const file = new File([bytes], candidate.filename, {
      type: mimeTypeFor(candidate.filename),
      lastModified: stable.lastModified,
    });
    const imported = await importWatchedPhotoToSession(sessionId, file, candidate.path, queueItem.id, imageStream);
    if (!imported) {
      await recordImageStreamActivity(imageStream?.id ?? candidate.imageStreamId, 'skipped', candidate.filename);
      return 'skipped';
    }

    try {
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(candidate.path);
      await updateImportQueueItem(queueItem.id, {
        error: 'Imported into managed storage; source file removed from watched folder.',
      });
    } catch (deleteError) {
      console.warn('[PhotoFlow] Imported watched file but could not remove the source file.', deleteError);
      await updateImportQueueItem(queueItem.id, {
        error: deleteError instanceof Error
          ? `Imported, but source cleanup failed: ${deleteError.message}`
          : 'Imported, but source cleanup failed.',
      });
    }
    await recordImageStreamActivity(imageStream?.id ?? candidate.imageStreamId, 'imported', candidate.filename);
    return 'complete';
  } catch (error) {
    const msg = error instanceof Error ? error.message
      : typeof error === 'string' ? error
      : 'Watched-folder import failed.';
    await updateImportQueueItem(queueItem.id, {
      status: 'failed',
      progress: 100,
      error: msg,
      completedAt: new Date().toISOString(),
    });
    await recordImageStreamActivity(imageStream?.id ?? candidate.imageStreamId, 'failed', candidate.filename);
    return 'failed';
  }
}
