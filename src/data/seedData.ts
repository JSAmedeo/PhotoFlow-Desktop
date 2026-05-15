// Seed data for PhotoFlow Desktop demo state.
// Auto-loaded into localStorage on first run (or after resetDemoData()).
// Shape matches the domain models in models.ts.

import type { Session, Photo, CaptureLocation, HourBucket } from './models';
import { TINTS } from './models';

export const SEED_LOCATIONS: CaptureLocation[] = [
  { id: 'loc-1', name: 'Main Gate',  code: 'XYZ-MGT', isActive: true  },
  { id: 'loc-2', name: 'Giraffes',   code: 'XYZ-GIR', isActive: true  },
  { id: 'loc-3', name: 'Pandas',     code: 'XYZ-PND', isActive: true  },
  { id: 'loc-4', name: 'Statue',     code: 'XYZ-STA', isActive: false },
];

export const SEED_HOURS: HourBucket[] = [
  { h: '08:00', label: '8 – 9 AM',   sub: 'Open',       count: 14, photoCount: 14, flagged: 0 },
  { h: '09:00', label: '9 – 10 AM',  sub: 'Morning',    count: 32, photoCount: 32, flagged: 2 },
  { h: '10:00', label: '10 – 11 AM', sub: 'Morning',    count: 48, photoCount: 48, flagged: 1 },
  { h: '11:00', label: '11 – 12 PM', sub: 'Late AM',    count: 54, photoCount: 54, flagged: 3 },
  { h: '12:00', label: '12 – 1 PM',  sub: 'Midday',     count: 61, photoCount: 61, flagged: 4 },
  { h: '13:00', label: '1 – 2 PM',   sub: 'Lunch peak', count: 72, photoCount: 72, flagged: 5 },
  { h: '14:00', label: '2 – 3 PM',   sub: 'Afternoon',  count: 58, photoCount: 58, flagged: 2 },
  { h: '15:00', label: '3 – 4 PM',   sub: 'Afternoon',  count: 46, photoCount: 46, flagged: 1 },
  { h: '16:00', label: '4 – 5 PM',   sub: 'Late PM',    count: 41, photoCount: 41, flagged: 2 },
  { h: '17:00', label: '5 – 6 PM',   sub: 'Wind down',  count: 28, photoCount: 28, flagged: 0 },
  { h: '18:00', label: '6 – 7 PM',   sub: 'Evening',    count: 12, photoCount: 12, flagged: 0 },
  { h: '19:00', label: '7 – 8 PM',   sub: 'Close',      count:  5, photoCount:  5, flagged: 0 },
];

export const SEED_SESSIONS: Session[] = [
  { id: 's-01', sessionCode: 'XYZ0001411', barcode: 'XYZ0001411', captureLocationId: 'loc-2', captureLocationLabel: 'Giraffes · XYZ-GIR', handler: 'A. Patel',  createdAt: '2026-05-13T14:02:17', updatedAt: '2026-05-13T14:02:17', photoCount: 4, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[0]  },
  { id: 's-02', sessionCode: 'XYZ0001412', barcode: 'XYZ0001412', captureLocationId: 'loc-2', captureLocationLabel: 'Giraffes · XYZ-GIR', handler: 'A. Patel',  createdAt: '2026-05-13T14:05:33', updatedAt: '2026-05-13T14:05:33', photoCount: 3, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[1]  },
  { id: 's-03', sessionCode: 'XYZ0001413', barcode: 'XYZ0001413', captureLocationId: 'loc-2', captureLocationLabel: 'Giraffes · XYZ-GIR', handler: 'M. Torres', createdAt: '2026-05-13T14:08:46', updatedAt: '2026-05-13T14:08:46', photoCount: 5, status: 'flagged',  notes: 'Wrong guest in frame 1', linkedSessionIds: [], tint: TINTS[2]  },
  { id: 's-04', sessionCode: 'XYZ0001414', barcode: 'XYZ0001414', captureLocationId: 'loc-1', captureLocationLabel: 'Main Gate · XYZ-MGT', handler: 'J. Kim',    createdAt: '2026-05-13T14:11:09', updatedAt: '2026-05-13T14:11:09', photoCount: 2, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[3]  },
  { id: 's-05', sessionCode: 'XYZ0001415', barcode: 'XYZ0001415', captureLocationId: 'loc-2', captureLocationLabel: 'Giraffes · XYZ-GIR', handler: 'A. Patel',  createdAt: '2026-05-13T14:14:51', updatedAt: '2026-05-13T14:14:51', photoCount: 4, status: 'active',   notes: '', linkedSessionIds: [], tint: TINTS[4]  },
  { id: 's-06', sessionCode: 'XYZ0001416', barcode: 'XYZ0001416', captureLocationId: 'loc-3', captureLocationLabel: 'Pandas · XYZ-PND',   handler: 'R. Chen',   createdAt: '2026-05-13T14:18:02', updatedAt: '2026-05-13T14:18:02', photoCount: 3, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[5]  },
  { id: 's-07', sessionCode: 'XYZ0001417', barcode: 'XYZ0001417', captureLocationId: 'loc-2', captureLocationLabel: 'Giraffes · XYZ-GIR', handler: 'A. Patel',  createdAt: '2026-05-13T14:21:27', updatedAt: '2026-05-13T14:21:27', photoCount: 4, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[6]  },
  { id: 's-08', sessionCode: 'XYZ0001418', barcode: 'XYZ0001418', captureLocationId: 'loc-4', captureLocationLabel: 'Statue · XYZ-STA',   handler: 'L. Nguyen', createdAt: '2026-05-13T14:24:18', updatedAt: '2026-05-13T14:24:18', photoCount: 5, status: 'flagged',  notes: 'Soft mask edge on frame 3', linkedSessionIds: [], tint: TINTS[7]  },
  { id: 's-09', sessionCode: 'XYZ0001419', barcode: 'XYZ0001419', captureLocationId: 'loc-1', captureLocationLabel: 'Main Gate · XYZ-MGT', handler: 'J. Kim',    createdAt: '2026-05-13T14:27:55', updatedAt: '2026-05-13T14:27:55', photoCount: 3, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[8]  },
  { id: 's-10', sessionCode: 'XYZ0001420', barcode: 'XYZ0001420', captureLocationId: 'loc-2', captureLocationLabel: 'Giraffes · XYZ-GIR', handler: 'A. Patel',  createdAt: '2026-05-13T14:31:02', updatedAt: '2026-05-13T14:31:02', photoCount: 4, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[9]  },
  { id: 's-11', sessionCode: 'XYZ0001421', barcode: 'XYZ0001421', captureLocationId: 'loc-3', captureLocationLabel: 'Pandas · XYZ-PND',   handler: 'R. Chen',   createdAt: '2026-05-13T14:34:39', updatedAt: '2026-05-13T14:34:39', photoCount: 2, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[10] },
  { id: 's-12', sessionCode: 'XYZ0001422', barcode: 'XYZ0001422', captureLocationId: 'loc-2', captureLocationLabel: 'Giraffes · XYZ-GIR', handler: 'A. Patel',  createdAt: '2026-05-13T14:38:12', updatedAt: '2026-05-13T14:38:12', photoCount: 4, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[11] },
  { id: 's-13', sessionCode: 'XYZ0001423', barcode: 'XYZ0001423', captureLocationId: 'loc-4', captureLocationLabel: 'Statue · XYZ-STA',   handler: 'L. Nguyen', createdAt: '2026-05-13T14:41:47', updatedAt: '2026-05-13T14:41:47', photoCount: 3, status: 'complete', notes: '', linkedSessionIds: [], tint: TINTS[0]  },
  { id: 's-14', sessionCode: 'XYZ0001424', barcode: 'XYZ0001424', captureLocationId: 'loc-1', captureLocationLabel: 'Main Gate · XYZ-MGT', handler: 'M. Torres', createdAt: '2026-05-13T14:45:23', updatedAt: '2026-05-13T14:45:23', photoCount: 5, status: 'flagged',  notes: '', linkedSessionIds: [], tint: TINTS[1]  },
];

// Generate photos for each session — 1 photo record per session slot.
// In Phase 3 these will be replaced by real ingested file records.
function makePhotos(session: Session): Photo[] {
  return Array.from({ length: session.photoCount }, (_, i) => ({
    id:                `${session.id}-p${i + 1}`,
    sessionId:         session.id,
    filename:          `${session.sessionCode}_frame${String(i + 1).padStart(2, '0')}.CR3`,
    thumbnailUrl:      '/demo-assets/before.jpg',
    displayUrl:        '/demo-assets/before.jpg',
    beforeImageUrl:    '/demo-assets/before.jpg',
    afterImageUrl:     '/demo-assets/after.png',
    createdAt:         session.createdAt,
    captureLocationId: session.captureLocationId,
    processingStatus:  (i === 2 ? 'processing' : i === 3 ? 'warn' : 'done') as Photo['processingStatus'],
    flag:              (session.status === 'flagged' && i === 0 ? 'flagged' : 'none') as Photo['flag'],
    isFavorite:        false,
    isHidden:          false,
    operatorNotes:     '',
    enhanceVersion:    'v2.4',
    width:             6000,
    height:            4000,
    fileSizeMb:        24.7,
    fileFormat:        'CR3',
  }));
}

export const SEED_PHOTOS: Photo[] = SEED_SESSIONS.flatMap(makePhotos);

export const DEFAULT_SELECTED_SESSION_ID = 's-05';   // XYZ0001415
export const DEFAULT_SELECTED_HOUR       = '14:00';
