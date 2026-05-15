import type { Session } from '../data/models';
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
}

function tintForSessionKey(sessionKey: string): [string, string] {
  const index = sessionKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % TINTS.length;
  return TINTS[index];
}

async function makeSession(sessionKey: string, fallbackSessionId?: string): Promise<Session> {
  const store = await getMetadataStore();
  const fallback = fallbackSessionId ? await store.getSessionById(fallbackSessionId) : undefined;
  const locations = await store.getLocations();
  const fallbackLocation = locations.find(location => location.isActive) ?? locations[0];
  const now = new Date().toISOString();

  return {
    id: `session-${sessionKey}`,
    sessionCode: sessionKey,
    barcode: sessionKey,
    captureLocationId: fallback?.captureLocationId ?? fallbackLocation?.id ?? 'unassigned',
    captureLocationLabel: fallback?.captureLocationLabel ?? (
      fallbackLocation ? `${fallbackLocation.name} · ${fallbackLocation.code}` : 'Unassigned'
    ),
    handler: fallback?.handler ?? 'Auto route',
    createdAt: now,
    updatedAt: now,
    photoCount: 0,
    status: 'active',
    notes: 'Auto-created from imported filename.',
    linkedSessionIds: [],
    tint: tintForSessionKey(sessionKey),
  };
}

export async function routePhotoToSession(input: RoutePhotoInput): Promise<SessionRoutingResult> {
  const { parsed, fallbackSessionId } = input;

  if (!parsed.sessionKey) {
    return {
      status: 'unrouted',
      sequenceNumber: parsed.sequenceNumber,
      sequenceLabel: parsed.sequenceLabel,
      reason: parsed.reason ?? 'Filename did not contain a routable session ID.',
    };
  }

  const store = await getMetadataStore();
  const existing = await store.getSessionByCode(parsed.sessionKey);
  const session = existing ?? await store.addSession(await makeSession(parsed.sessionKey, fallbackSessionId));

  return {
    status: 'routed',
    session,
    sessionId: session.id,
    sessionKey: session.sessionCode,
    sequenceNumber: parsed.sequenceNumber,
    sequenceLabel: parsed.sequenceLabel,
    reason: existing ? 'Matched existing session.' : 'Created session from filename.',
  };
}
