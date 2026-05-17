import type {
  AutoPrintItem,
  AutoPrintSize,
  FileNamingExtension,
  FileNamingField,
  FileNamingFieldType,
  FileNamingSeparator,
  ImageStreamStatus,
  ImportQueueItem,
} from '../../data/models';

export interface FolderFileEntry {
  name: string;
  size: number;
  modified_ms: number | null;
}

export interface TemplateEntry {
  id: string;
  name: string;
  meta: string;
  style: 'none' | 'classic' | 'polaroid' | 'safari' | 'strip' | 'banner' | 'caption';
}

export interface TemplateSizeGroup {
  size: AutoPrintSize;
  sizeLabel: string;
  templates: TemplateEntry[];
}

export interface TemplateCollection {
  id: string;
  label: string;
  desc: string;
  sizes: TemplateSizeGroup[];
}

export function statusLabel(status: ImageStreamStatus, enabled: boolean): string {
  if (!enabled) return 'Paused';
  if (status === 'receiving') return 'Receiving';
  if (status === 'watching') return 'Watching';
  if (status === 'review') return 'Review';
  if (status === 'error') return 'Error';
  return 'Idle';
}

export function statusColor(status: ImageStreamStatus, enabled: boolean): string {
  if (!enabled) return 'var(--ink-4)';
  if (status === 'error' || status === 'review') return 'var(--warn)';
  if (status === 'watching' || status === 'receiving') return 'var(--ok)';
  return 'var(--accent)';
}

export function fmtTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function computeSparkline(streamId: string, queue: ImportQueueItem[]): number[] {
  const now = Date.now();
  const windowMs = 30 * 60 * 1000;
  const buckets = new Array(30).fill(0);
  for (const item of queue) {
    if (item.imageStreamId !== streamId) continue;
    const ts = item.importedAt ?? item.detectedAt ?? item.createdAt;
    if (!ts) continue;
    const age = now - new Date(ts).getTime();
    if (age < 0 || age > windowMs) continue;
    const idx = Math.min(29, Math.floor(((windowMs - age) / windowMs) * 30));
    buckets[idx]++;
  }
  return buckets;
}

export function codeFromName(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return `XYZ-${(letters || 'OP').padEnd(3, 'X')}`;
}

export function sanitizePreview(value: string): string {
  return value.trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]+/g, '') || 'TEXT';
}

export function previewFilename(
  fields: FileNamingField[],
  separator: FileNamingSeparator,
  extension: FileNamingExtension,
  name: string,
  code: string,
): string {
  const parts = (fields.length ? fields : DEFAULT_NAMING_FIELDS).map(field => {
    if (field.type === 'custom') return field.customText || 'TEXT';
    if (field.type === 'barcode') return '0006';
    if (field.type === 'seq-number') return '01';
    if (field.type === 'stream-name') return name || 'PHOTO_OP';
    if (field.type === 'stream-code') return code || codeFromName(name);
    if (field.type === 'original-filename') return 'IMG_4536';
    if (field.type === 'date') return '20260514';
    return 'TEXT';
  }).map(sanitizePreview);
  return `${parts.join(separator)}.${extension}`;
}

export function makeField(type: FileNamingFieldType = 'custom'): FileNamingField {
  return {
    id: `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    customText: type === 'custom' ? '' : undefined,
  };
}

export function makePrintItem(): AutoPrintItem {
  return {
    id: `print-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    quantity: 1,
    size: '4x6',
    template: 'tpl-main-4x6-1',
    templateSubline: '4 × 6 in',
  };
}

export const DEFAULT_NAMING_FIELDS: FileNamingField[] = [
  { id: 'field-custom', type: 'custom', customText: 'TEXT' },
  { id: 'field-barcode', type: 'barcode' },
  { id: 'field-sequence', type: 'seq-number' },
];

export const NAMING_FIELD_OPTIONS: Array<{ value: FileNamingFieldType; label: string }> = [
  { value: 'custom', label: 'Custom' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'seq-number', label: 'Seq Number' },
  { value: 'stream-name', label: 'Photo Op' },
  { value: 'stream-code', label: 'Photo Op Code' },
  { value: 'original-filename', label: 'Original File' },
  { value: 'date', label: 'Date' },
];

export const PRINT_SIZES: Array<{ id: AutoPrintSize; label: string; sub: string }> = [
  { id: '4x6',     label: '4 × 6 in', sub: 'Postcard' },
  { id: '6x8',     label: '6 × 8 in', sub: 'Large' },
  { id: 'wallets', label: 'Wallets',   sub: '4-up · 2.5 × 3.5 in' },
];

export const TEMPLATE_COLLECTIONS: TemplateCollection[] = [
  { id: 'main', label: 'Main Collection', desc: 'Default branded templates · year-round', sizes: [
    { size: '4x6', sizeLabel: '4 × 6 in', templates: [
      { id: 'tpl-main-4x6-1', name: 'Main 1', meta: 'Classic matte',      style: 'classic'  },
      { id: 'tpl-main-4x6-2', name: 'Main 2', meta: 'Polaroid · vintage', style: 'polaroid' },
    ]},
    { size: '6x8', sizeLabel: '6 × 8 in', templates: [
      { id: 'tpl-main-6x8-1', name: 'Main 1', meta: 'Standard · centered', style: 'classic' },
      { id: 'tpl-main-6x8-2', name: 'Main 2', meta: 'Logo banner top',     style: 'banner'  },
    ]},
    { size: 'wallets', sizeLabel: 'Wallets', templates: [
      { id: 'tpl-main-w-1', name: '4-up Sheet', meta: '2.5 × 3.5 in × 4', style: 'strip' },
    ]},
  ]},
  { id: 'holiday', label: 'Holiday Collection', desc: 'Seasonal · winter park', sizes: [
    { size: '4x6', sizeLabel: '4 × 6 in', templates: [
      { id: 'tpl-holiday-4x6-1', name: 'Winter',  meta: 'Frost + venue mark', style: 'caption' },
    ]},
    { size: '6x8', sizeLabel: '6 × 8 in', templates: [
      { id: 'tpl-holiday-6x8-1', name: 'Holiday', meta: 'Seasonal headline',  style: 'caption' },
    ]},
  ]},
  { id: 'safari', label: 'Safari Edition', desc: 'Wildlife themed · earth tones', sizes: [
    { size: '4x6', sizeLabel: '4 × 6 in', templates: [
      { id: 'tpl-safari-4x6-1', name: 'Wildlife', meta: 'Leaf corners · cream', style: 'safari' },
    ]},
    { size: '6x8', sizeLabel: '6 × 8 in', templates: [
      { id: 'tpl-safari-6x8-1', name: 'Wildlife', meta: 'Leaf corners · cream', style: 'safari' },
    ]},
  ]},
  { id: 'bleed', label: 'Edge-to-Edge', desc: 'Borderless · full bleed prints', sizes: [
    { size: '4x6', sizeLabel: '4 × 6 in', templates: [
      { id: 'tpl-bleed-4x6-1', name: 'Bleed', meta: 'No border', style: 'none' },
    ]},
    { size: '6x8', sizeLabel: '6 × 8 in', templates: [
      { id: 'tpl-bleed-6x8-1', name: 'Bleed', meta: 'No border', style: 'none' },
    ]},
  ]},
];

export const ALL_TEMPLATES = TEMPLATE_COLLECTIONS.flatMap(c =>
  c.sizes.flatMap(s => s.templates.map(t => ({ ...t, collectionId: c.id, collectionLabel: c.label, size: s.size, sizeLabel: s.sizeLabel })))
);

export const TEMPLATE_BY_ID = Object.fromEntries(ALL_TEMPLATES.map(t => [t.id, t]));

export const DEFAULT_PRINT_ITEMS: AutoPrintItem[] = [
  { id: 'print-4x6-main',     quantity: 2, size: '4x6',    template: 'tpl-main-4x6-1',    templateSubline: '4 × 6 in' },
  { id: 'print-6x8-holiday',  quantity: 1, size: '6x8',    template: 'tpl-holiday-6x8-1', templateSubline: '6 × 8 in' },
  { id: 'print-wallets-main', quantity: 4, size: 'wallets', template: 'tpl-main-w-1',      templateSubline: 'Wallets'  },
];

export const INSTALLED_PRINTERS = [
  { name: 'Epson SureColor P900', state: 'ready', sizes: '4×6 · 5×7 · 6×8 · 8×10' },
  { name: 'Epson SureLab D870',   state: 'ready', sizes: '4×6 · 6×8' },
  { name: 'Canon imagePROGRAF',   state: 'idle',  sizes: '8×10 · 11×14' },
  { name: 'DNP DS820A',           state: 'ready', sizes: '4×6 · wallets · strip' },
];
