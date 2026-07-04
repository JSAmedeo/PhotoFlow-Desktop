// Core domain types for PhotoFlow Desktop.
// All interfaces are shaped for future Phase 3+ wiring (real files, real ingest).

export type PhotoVersionKind = 'original' | 'enhanced' | 'bg-removed';

export interface PhotoVersion {
  id: string;
  photoId: string;
  kind: PhotoVersionKind;
  storagePath: string;
  displayUrl: string;
  createdAt: string;
  fileSizeMb: number;
}

export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'warn' | 'error';
export type PhotoFlag = 'none' | 'flagged' | 'rejected' | 'favorite';
export type SessionStatus = 'active' | 'complete' | 'flagged' | 'archived';
export type TabKey = 'gallery' | 'workshop' | 'streams' | 'print' | 'config';
export type FilterKey = 'All' | 'Flagged' | 'Processed' | 'Pending';
export type ImportStatus = 'queued' | 'stabilizing' | 'importing' | 'complete' | 'skipped' | 'failed';
export type PhotoStorageKind = 'demo-asset' | 'browser-data-url' | 'tauri-managed-file';
export type ImportSourceType = 'manual-picker' | 'watched-folder';
export type RoutingStatus = 'routed' | 'unrouted' | 'routing_failed';
export type WatcherStatus = 'desktop-only' | 'off' | 'watching' | 'importing' | 'error';
export type ImageStreamType = 'local-folder' | 'api-placeholder';
export type ImageStreamStatus = 'disabled' | 'idle' | 'watching' | 'receiving' | 'review' | 'error';
export type FileNamingFieldType = 'custom' | 'barcode' | 'seq-number' | 'stream-name' | 'stream-code' | 'original-filename' | 'date';
export type FileNamingSeparator = '-' | '.' | '_';
export type FileNamingExtension = 'JPG' | 'DNG' | 'RAW';
export type AutoPrintSize = '4x6' | '6x8' | 'wallets';

export interface FileNamingField {
  id: string;
  type: FileNamingFieldType;
  customText?: string;
}

export interface AutoPrintItem {
  id: string;
  quantity: number;
  size: AutoPrintSize;
  template: string;
  templateSubline?: string;
}

export interface CaptureLocation {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface ImageStream {
  id: string;
  name: string;
  slug: string;
  code?: string;
  type: ImageStreamType;
  enabled: boolean;
  watchPath?: string | null;
  status: ImageStreamStatus;
  lastActivityAt?: string | null;
  lastDetectedFilename?: string | null;
  lastImportedFilename?: string | null;
  totalDetected: number;
  totalImported: number;
  totalSkipped: number;
  totalFailed: number;
  filesPerMinute?: number;
  processingPreset?: string | null;
  printerName?: string | null;
  autoPrintEnabled?: boolean;
  autoPrintItems?: AutoPrintItem[];
  fileRenamingEnabled?: boolean;
  fileNamingFields?: FileNamingField[];
  fileNamingSeparator?: FileNamingSeparator;
  fileNamingExtension?: FileNamingExtension;
  captureLocationId?: string | null;
  autoEnhanceEnabled?: boolean;
  enhanceBrightness?: number;
  enhanceContrast?: number;
  enhanceSaturation?: number;
  enhanceSharpen?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  sessionCode: string;
  barcode: string;
  captureLocationId: string;
  captureLocationLabel: string; // pre-joined display string e.g. "Giraffes · XYZ-GIR"
  handler: string;
  createdAt: string;           // ISO string
  updatedAt: string;
  photoCount: number;
  status: SessionStatus;
  notes: string;
  linkedSessionIds: string[];
  tint: [string, string];      // display only — colored SVG tile gradient
}

export interface Photo {
  id: string;
  sessionId: string;
  filename: string;
  thumbnailUrl: string;
  displayUrl: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  createdAt: string;           // ISO string
  captureLocationId: string;
  processingStatus: ProcessingStatus;
  flag: PhotoFlag;
  isFavorite: boolean;
  isHidden: boolean;
  operatorNotes: string;
  enhanceVersion: string;
  width: number;
  height: number;
  fileSizeMb: number;
  fileFormat: string;
  originalPath?: string;
  storageKind?: PhotoStorageKind;
  storagePath?: string;
  sourceType?: ImportSourceType;
  sourcePath?: string;
  managedOriginalPath?: string;
  imageStreamId?: string | null;
  imageStreamName?: string | null;
  importedAt?: string;
  originalFilename?: string;
  sourceFilename?: string;
  sessionKey?: string;
  sequenceNumber?: number | null;
  sequenceLabel?: string | null;
  routingStatus?: RoutingStatus;
  routingReason?: string;
  sizeBytes?: number;
  lastModified?: number;
  // SHA-256 hex of the original imported bytes. Used to skip re-importing a genuinely
  // identical re-sent capture (content de-duplication). Set on watched-folder imports.
  contentHash?: string;
  importedFile?: ImportedFileMetadata;
  autoEnhanceEnabled?: boolean;
  activeVersionKind?: PhotoVersionKind;
}

export interface ImportedFileMetadata {
  filename: string;
  fileSize: number;
  lastModified: number;
  mimeType: string;
}

export interface ImportQueueItem {
  id: string;
  filename: string;
  sessionId: string;
  status: ImportStatus;
  progress: number;
  fileSize?: number;
  lastModified?: number;
  sourceType?: ImportSourceType;
  sourcePath?: string;
  sourceFilename?: string;
  imageStreamId?: string | null;
  imageStreamName?: string | null;
  streamType?: ImageStreamType;
  parsedSessionKey?: string;
  parsedSequenceNumber?: number | null;
  routingStatus?: RoutingStatus;
  routingReason?: string;
  destinationPath?: string;
  photoId?: string;
  detectedAt?: string;
  importedAt?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface WatchedFolderSettings {
  watchEnabled: boolean;
  watchedImportFolder: string | null;
  fileSettleDelayMs: number;
  defaultCaptureLocationId: string;
  defaultSessionAssignmentMode: 'active-session';
}

export interface WatcherRuntimeState {
  status: WatcherStatus;
  lastDetected?: string;
  lastImport?: string;
  error?: string;
}

// Lightweight type used by the hourly folder list in the left panel
export interface HourBucket {
  h: string;       // "14:00"
  label: string;   // "2 – 3 PM"
  count: number;   // unique sessions imported in this hour
  photoCount: number;
  isEmpty?: boolean;
  sub?: string;
  flagged?: number;
}

export const HOUR_SHORT: Record<string, string> = {
  '08:00': '8 AM',  '09:00': '9 AM',  '10:00': '10 AM', '11:00': '11 AM',
  '12:00': '12 PM', '13:00': '1 PM',  '14:00': '2 PM',  '15:00': '3 PM',
  '16:00': '4 PM',  '17:00': '5 PM',  '18:00': '6 PM',  '19:00': '7 PM',
};

export const TINTS: [string, string][] = [
  ['#3a5f78', '#1f3a4a'], ['#5a4878', '#2f2a4a'], ['#4a7858', '#1f4a30'],
  ['#785a48', '#4a2f1f'], ['#4f5878', '#2a304a'], ['#785063', '#4a2a36'],
  ['#3a7868', '#1f4a3f'], ['#787858', '#4a4a2a'], ['#583a78', '#2f1f4a'],
  ['#487868', '#1f4a3f'], ['#78483a', '#4a201f'], ['#3a4878', '#1f2a4a'],
];
