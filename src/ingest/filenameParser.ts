export interface ParsedPhotoFilename {
  originalFilename: string;
  sessionKey: string;           // always non-null; derived from stem when no pattern matched
  sequenceNumber: number | null;
  sequenceLabel: string | null;
  routingConfidence: 'matched' | 'fallback';
  reason?: string;
}

const SESSION_PATTERN = /[A-Z]{3}\d{6}/;
const NEAR_SEQUENCE_PATTERN = /^[ _-]+(\d{1,4})(?=$|[^0-9])/;

function stripExtension(filename: string): string {
  const lastSlash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  const basename = lastSlash >= 0 ? filename.slice(lastSlash + 1) : filename;
  const dot = basename.lastIndexOf('.');
  return dot > 0 ? basename.slice(0, dot) : basename;
}

// Derive a session key from an arbitrary filename stem when no standard pattern matches.
// Keeps alphanumeric characters; collapses everything else into hyphens.
function deriveFallbackKey(stem: string): string {
  const sanitized = stem
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return sanitized || `FILE-${Date.now().toString(36).toUpperCase()}`;
}

export function parsePhotoFilename(filename: string): ParsedPhotoFilename {
  const originalFilename = String(filename ?? '');
  // Uppercase the stem before matching so lowercase/mixed-case filenames are
  // normalized without the /i flag — the pattern explicitly matches uppercase.
  const stem = stripExtension(originalFilename).toUpperCase();
  const match = SESSION_PATTERN.exec(stem);

  if (!match) {
    return {
      originalFilename,
      sessionKey: deriveFallbackKey(stripExtension(originalFilename)),
      sequenceNumber: null,
      sequenceLabel: null,
      routingConfidence: 'fallback',
      reason: 'No three-letter/six-digit session code found; using filename as session key.',
    };
  }

  const sessionKey = match[0];
  const afterSession = stem.slice(match.index + match[0].length);
  const sequenceMatch = NEAR_SEQUENCE_PATTERN.exec(afterSession);
  const sequenceLabel = sequenceMatch?.[1] ?? null;

  return {
    originalFilename,
    sessionKey,
    sequenceNumber: sequenceLabel == null ? null : Number.parseInt(sequenceLabel, 10),
    sequenceLabel,
    routingConfidence: 'matched',
    reason: 'First valid session ID found from left to right.',
  };
}
