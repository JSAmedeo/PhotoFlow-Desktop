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
  // Returns a snapshot copy, like a real store reading a row.
  getImageStreamById: vi.fn(async () => ({ ...stream })),
  // Async write with a small delay so the read-modify-write window is real; without
  // serialization, concurrent callers would read the same stale counts and lose increments.
  updateImageStream: vi.fn(async (_id: string, changes: Partial<ImageStream>) => {
    await new Promise(resolve => setTimeout(resolve, 2));
    stream = { ...stream, ...changes, updatedAt: new Date().toISOString() };
    return stream;
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
    expect(store.updateImageStream).toHaveBeenCalledTimes(N);
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
