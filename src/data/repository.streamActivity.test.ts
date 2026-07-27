import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./stores/metadataStoreFactory', () => ({
  getMetadataStore: vi.fn(),
  initializeMetadataStore: vi.fn(),
}));

import { recordImageStreamActivity } from './repository';
import { getMetadataStore } from './stores/metadataStoreFactory';
import type { ImageStream } from './models';

function makeStream(): ImageStream {
  return {
    id: 'stream-1',
    name: 'Test Stream',
    slug: 'test-stream',
    type: 'local-folder',
    enabled: true,
    watchPath: 'C:\\Watch',
    status: 'watching',
    totalDetected: 0,
    totalImported: 0,
    totalSkipped: 0,
    totalFailed: 0,
    filesPerMinute: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

let stream: ImageStream;

const store = {
  // Mirrors the browser store's read-modify-write recordStreamActivity, with a small
  // delay so the read-modify-write window is real; without the repository-level
  // serialization chain, concurrent callers would read the same stale counts and
  // lose increments. (The SQLite store increments atomically in SQL instead.)
  recordStreamActivity: vi.fn(async (_id: string, event: 'detected' | 'imported' | 'skipped' | 'failed', filename: string) => {
    const snapshot = { ...stream };
    await new Promise(resolve => setTimeout(resolve, 2));
    stream = {
      ...snapshot,
      lastDetectedFilename: event === 'detected' ? filename : snapshot.lastDetectedFilename,
      lastImportedFilename: event === 'imported' ? filename : snapshot.lastImportedFilename,
      totalDetected: snapshot.totalDetected + (event === 'detected' ? 1 : 0),
      totalImported: snapshot.totalImported + (event === 'imported' ? 1 : 0),
      totalSkipped: snapshot.totalSkipped + (event === 'skipped' ? 1 : 0),
      totalFailed: snapshot.totalFailed + (event === 'failed' ? 1 : 0),
      updatedAt: new Date().toISOString(),
    };
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  stream = makeStream();
  vi.mocked(getMetadataStore).mockResolvedValue(store as never);
});

describe('recordImageStreamActivity concurrency (Fix 2)', () => {
  it('does not lose increments when fired concurrently for one stream', async () => {
    const N = 25;
    await Promise.all(
      Array.from({ length: N }, () => recordImageStreamActivity('stream-1', 'detected', 'x.jpg')),
    );
    expect(stream.totalDetected).toBe(N);
    expect(store.recordStreamActivity).toHaveBeenCalledTimes(N);
  });

  it('totals each event type independently under a mixed concurrent burst', async () => {
    await Promise.all([
      recordImageStreamActivity('stream-1', 'detected', 'a.jpg'),
      recordImageStreamActivity('stream-1', 'imported', 'a.jpg'),
      recordImageStreamActivity('stream-1', 'detected', 'b.jpg'),
      recordImageStreamActivity('stream-1', 'imported', 'b.jpg'),
      recordImageStreamActivity('stream-1', 'skipped', 'c.jpg'),
      recordImageStreamActivity('stream-1', 'failed', 'd.jpg'),
    ]);
    expect(stream.totalDetected).toBe(2);
    expect(stream.totalImported).toBe(2);
    expect(stream.totalSkipped).toBe(1);
    expect(stream.totalFailed).toBe(1);
  });
});
