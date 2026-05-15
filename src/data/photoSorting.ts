import type { Photo } from './models';

export function comparePhotosForDisplay(a: Photo, b: Photo): number {
  if (a.sessionId !== b.sessionId) return a.sessionId.localeCompare(b.sessionId);

  const aHasSequence = a.sequenceNumber != null;
  const bHasSequence = b.sequenceNumber != null;
  if (aHasSequence && bHasSequence && a.sequenceNumber !== b.sequenceNumber) {
    return Number(a.sequenceNumber) - Number(b.sequenceNumber);
  }
  if (aHasSequence !== bHasSequence) return aHasSequence ? -1 : 1;

  const time = a.createdAt.localeCompare(b.createdAt);
  if (time !== 0) return time;

  const filename = a.filename.localeCompare(b.filename);
  if (filename !== 0) return filename;

  return a.id.localeCompare(b.id);
}
