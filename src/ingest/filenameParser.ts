export interface ParsedPhotoFilename {
  originalFilename: string;
  sessionKey: string | null;
  sequenceNumber: number | null;
  sequenceLabel: string | null;
  routingConfidence: 'matched' | 'unmatched';
  reason?: string;
}

const SESSION_PATTERN = /[A-Z]{3}\d{6}/i;
const NEAR_SEQUENCE_PATTERN = /^[ _-]+(\d{1,4})(?=$|[^0-9])/;

function stripExtension(filename: string): string {
  const lastSlash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  const basename = lastSlash >= 0 ? filename.slice(lastSlash + 1) : filename;
  const dot = basename.lastIndexOf('.');
  return dot > 0 ? basename.slice(0, dot) : basename;
}

export function parsePhotoFilename(filename: string): ParsedPhotoFilename {
  const originalFilename = String(filename ?? '');
  const stem = stripExtension(originalFilename);
  const match = SESSION_PATTERN.exec(stem);

  if (!match) {
    return {
      originalFilename,
      sessionKey: null,
      sequenceNumber: null,
      sequenceLabel: null,
      routingConfidence: 'unmatched',
      reason: 'No valid three-letter/six-digit session ID found.',
    };
  }

  const sessionKey = match[0].toUpperCase();
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
