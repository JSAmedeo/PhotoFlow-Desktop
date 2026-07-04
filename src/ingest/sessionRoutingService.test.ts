import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../data/stores/metadataStoreFactory', () => ({
  getMetadataStore: vi.fn(),
}));

import { routePhotoToSession } from './sessionRoutingService';
import { getMetadataStore } from '../data/stores/metadataStoreFactory';
import type { Session } from '../data/models';

const mockSession: Session = {
  id: 'session-ABC123456',
  sessionCode: 'ABC123456',
  barcode: 'ABC123456',
  captureLocationId: 'loc-1',
  captureLocationLabel: 'Main · MAIN',
  handler: 'Auto route',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  photoCount: 0,
  status: 'active',
  notes: '',
  linkedSessionIds: [],
  tint: ['#6366f1', '#818cf8'],
};

const mockStore = {
  getSessionByCode: vi.fn(),
  addSession: vi.fn().mockImplementation(async (s: Session) => s),
  getSessionById: vi.fn().mockResolvedValue(undefined),
  getLocations: vi.fn().mockResolvedValue([
    { id: 'loc-1', name: 'Main', code: 'MAIN', isActive: true },
  ]),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMetadataStore).mockResolvedValue(mockStore as never);
  mockStore.addSession.mockImplementation(async (s: Session) => s);
  mockStore.getSessionById.mockResolvedValue(undefined);
  mockStore.getLocations.mockResolvedValue([
    { id: 'loc-1', name: 'Main', code: 'MAIN', isActive: true },
  ]);
});

describe('routePhotoToSession', () => {
  it('creates a new session for fallback-routed files (no standard session code)', async () => {
    mockStore.getSessionByCode.mockResolvedValue(undefined);

    const result = await routePhotoToSession({
      parsed: {
        originalFilename: 'random-photo.jpg',
        sessionKey: 'RANDOM-PHOTO',
        sequenceNumber: null,
        sequenceLabel: null,
        routingConfidence: 'fallback',
        reason: 'No three-letter/six-digit session code found; using filename as session key.',
      },
    });

    expect(result.status).toBe('routed');
    expect(result.session).toBeDefined();
    expect(result.session?.sessionCode).toBe('RANDOM-PHOTO');
    expect(result.session?.notes).toContain('no recognizable session code');
    expect(mockStore.addSession).toHaveBeenCalledOnce();
  });

  it('passes sequence metadata through on fallback-routed result', async () => {
    mockStore.getSessionByCode.mockResolvedValue(undefined);

    const result = await routePhotoToSession({
      parsed: {
        originalFilename: 'photo.jpg',
        sessionKey: 'PHOTO',
        sequenceNumber: 3,
        sequenceLabel: '03',
        routingConfidence: 'fallback',
      },
    });

    expect(result.status).toBe('routed');
    expect(result.sequenceNumber).toBe(3);
    expect(result.sequenceLabel).toBe('03');
  });

  it('returns routed status and session when an existing session matches', async () => {
    mockStore.getSessionByCode.mockResolvedValue(mockSession);

    const result = await routePhotoToSession({
      parsed: {
        originalFilename: 'ABC123456_01.jpg',
        sessionKey: 'ABC123456',
        sequenceNumber: 1,
        sequenceLabel: '01',
        routingConfidence: 'matched',
      },
    });

    expect(result.status).toBe('routed');
    expect(result.sessionId).toBe(mockSession.id);
    expect(result.session).toBe(mockSession);
    expect(result.sequenceNumber).toBe(1);
    expect(result.sequenceLabel).toBe('01');
    expect(mockStore.addSession).not.toHaveBeenCalled();
  });

  // Regression for Fix 1 (Phase 10.5): a burst of files for the same brand-new session
  // key must create exactly one session, not race into N creates.
  it('creates exactly one session under concurrent routing for the same new key', async () => {
    let created: Session | undefined;
    // getSessionByCode returns undefined until addSession has run (mirrors a real store
    // where the row only exists after insert).
    mockStore.getSessionByCode.mockImplementation(async () => created);
    mockStore.addSession.mockImplementation(async (s: Session) => {
      // Simulate async insert latency so the race window is real.
      await new Promise(resolve => setTimeout(resolve, 5));
      created = s;
      return s;
    });

    const route = (seq: number) =>
      routePhotoToSession({
        parsed: {
          originalFilename: `NEW999999_${seq}.jpg`,
          sessionKey: 'NEW999999',
          sequenceNumber: seq,
          sequenceLabel: String(seq).padStart(2, '0'),
          routingConfidence: 'matched',
        },
      });

    const results = await Promise.all([route(1), route(2), route(3), route(4), route(5)]);

    expect(mockStore.addSession).toHaveBeenCalledOnce();
    expect(results).toHaveLength(5);
    const sessionIds = new Set(results.map(r => r.sessionId));
    expect(sessionIds.size).toBe(1);
    expect(results.every(r => r.status === 'routed')).toBe(true);
  });
});
