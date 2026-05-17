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
});
