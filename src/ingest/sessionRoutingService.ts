import type { CaptureLocation, Session } from '../data/models';
import { TINTS } from '../data/models';
import { getMetadataStore } from '../data/stores/metadataStoreFactory';
import type { ParsedPhotoFilename } from './filenameParser';

export interface SessionRoutingResult {
  status: 'routed' | 'unrouted';
  session?: Session;
  sessionId?: string;
  sessionKey?: string;
  sequenceNumber?: number | null;
  sequenceLabel?: string | null;
  reason?: string;
}

export interface RoutePhotoInput {
  parsed: ParsedPhotoFilename;
  fallbackSessionId?: string;
  captureLocation?: CaptureLocation;
}

function tintForSessionKey(sessionKey: string): [string, string] {
  const index = sessionKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % TINTS.length;
  return TINTS[index];
}

async function makeSession(
  sessionKey: string,
  routingConfidence: ParsedPhotoFilename['routingConfidence'],
  fallbackSessionId?: string,
  captureLocation?: CaptureLocation,
): Promise<Session> {
  const store = await getMetadataStore();
  const fallback = fallbackSessionId ? await store.getSessionById(fallbackSessionId) : undefined;
  const locations = await store.getLocations();
  const fallbackLocation = captureLocation ?? locations.find(location => location.isActive) ?? locations[0];
  const now = new Date().toISOString();

  return {
    id: `session-${sessionKey}-${Date.now().toString(36)}`,
    sessionCode: sessionKey,
    barcode: sessionKey,
    captureLocationId: captureLocation?.id ?? fallback?.captureLocationId ?? fallbackLocation?.id ?? 'unassigned',
    captureLocationLabel: captureLocation ? `${captureLocation.name} · ${captureLocation.code}` : fallback?.captureLocationLabel ?? (
      fallbackLocation ? `${fallbackLocation.name} · ${fallbackLocation.code}` : 'Unassigned'
    ),
    handler: fallback?.handler ?? 'Auto route',
    createdAt: now,
    updatedAt: now,
    photoCount: 0,
    status: 'active',
    notes: routingConfidence === 'fallback'
      ? 'Auto-created — no recognizable session code in filename.'
      : 'Auto-created from imported filename.',
    linkedSessionIds: [],
    tint: tintForSessionKey(sessionKey),
  };
}

function routedResult(session: Session, parsed: ParsedPhotoFilename, created: boolean): SessionRoutingResult {
  return {
    status: 'routed',
    session,
    sessionId: session.id,
    sessionKey: session.sessionCode,
    sequenceNumber: parsed.sequenceNumber,
    sequenceLabel: parsed.sequenceLabel,
    reason: !created
      ? 'Matched existing session.'
      : parsed.routingConfidence === 'fallback'
        ? 'Created session from filename (no standard session code).'
        : 'Created session from filename.',
  };
}

// Serializes get-or-create for a given session key within this JS context, so a burst of
// files for the same brand-new session creates exactly one session instead of racing.
// The only watcher-level dedup guard is keyed by file path, so two files for the same new
// session key (the normal FTP-burst case) both reach this function and would otherwise
// both call addSession.
const sessionCreationLocks = new Map<string, Promise<Session>>();

export async function routePhotoToSession(input: RoutePhotoInput): Promise<SessionRoutingResult> {
  const { parsed, fallbackSessionId, captureLocation } = input;
  const store = await getMetadataStore();
  const key = parsed.sessionKey.toUpperCase();

  // Fast path: session already exists.
  const existing = await store.getSessionByCode(key);
  if (existing) return routedResult(existing, parsed, false);

  // Slow path: serialize creation per key so concurrent callers don't double-create.
  let creation = sessionCreationLocks.get(key);
  if (!creation) {
    creation = (async () => {
      // Re-check inside the lock — another caller may have created it while we waited.
      const again = await store.getSessionByCode(key);
      if (again) return again;
      return store.addSession(
        await makeSession(parsed.sessionKey, parsed.routingConfidence, fallbackSessionId, captureLocation),
      );
    })();
    // Release the lock once settled, whether the creation resolved or threw.
    void creation.finally(() => sessionCreationLocks.delete(key));
    sessionCreationLocks.set(key, creation);
  }

  const session = await creation;
  return routedResult(session, parsed, true);
}
