import { stat } from '@tauri-apps/plugin-fs';

export interface StableFileInfo {
  size: number;
  lastModified: number;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export async function waitForStableFile(
  path: string,
  settleDelayMs: number,
  maxAttempts = 5,
  requiredStableChecks = 2,
): Promise<StableFileInfo> {
  let previous = await stat(path);
  let stableChecks = 0;

  if (!previous.isFile) {
    throw new Error('Watched path is not a file.');
  }

  // Cap each check interval so a large user-configured settle delay can't stall
  // the watcher indefinitely. Max total wait = maxAttempts × effectiveDelay (25 s default).
  const effectiveDelay = Math.min(settleDelayMs, 5_000);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await delay(effectiveDelay);
    const next = await stat(path);

    if (!next.isFile) {
      throw new Error('Watched path is no longer a file.');
    }

    const previousModified = previous.mtime?.getTime() ?? 0;
    const nextModified = next.mtime?.getTime() ?? 0;

    if (previous.size === next.size && previousModified === nextModified) {
      stableChecks += 1;
      if (stableChecks >= requiredStableChecks) {
        return {
          size: next.size,
          lastModified: nextModified,
        };
      }
    } else {
      stableChecks = 0;
    }

    previous = next;
  }

  throw new Error('File did not become stable before the retry limit.');
}
