import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  FileImage,
  Filter,
  Folder,
  FolderOpen,
  Grid3X3,
  Info,
  Layers,
  MapPin,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { AutoPrintItem, AutoPrintSize, FileNamingExtension, FileNamingField, FileNamingFieldType, FileNamingSeparator, ImageStream, ImageStreamStatus, ImportQueueItem } from '../../data/models';
import { isTauriRuntime } from '../../runtime/runtime';

async function openInExplorer(path: string): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('reveal_in_explorer', { path });
}

function statusLabel(status: ImageStreamStatus, enabled: boolean): string {
  if (!enabled) return 'Paused';
  if (status === 'receiving') return 'Receiving';
  if (status === 'watching') return 'Watching';
  if (status === 'review') return 'Review';
  if (status === 'error') return 'Error';
  return 'Idle';
}

function statusColor(status: ImageStreamStatus, enabled: boolean): string {
  if (!enabled) return 'var(--ink-4)';
  if (status === 'error' || status === 'review') return 'var(--warn)';
  if (status === 'watching' || status === 'receiving') return 'var(--ok)';
  return 'var(--accent)';
}

function fmtTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function computeSparkline(streamId: string, queue: ImportQueueItem[]): number[] {
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

function Sparkline({ data, width = 92, height = 22 }: { data: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...data);
  const step = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(height - (v / max) * (height - 2) - 1).toFixed(1)}`).join(' ');
  const area = `${pts} L ${width} ${height} L 0 ${height} Z`;
  const lastX = ((data.length - 1) * step).toFixed(1);
  const lastY = (height - (data[data.length - 1] / max) * (height - 2) - 1).toFixed(1);
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={area} fill="var(--accent)" fillOpacity="0.12" />
      <path d={pts} fill="none" stroke="var(--accent)" strokeWidth="1.2" />
      <circle cx={lastX} cy={lastY} r="2" fill="var(--accent)" />
    </svg>
  );
}

const DEFAULT_NAMING_FIELDS: FileNamingField[] = [
  { id: 'field-custom', type: 'custom', customText: 'TEXT' },
  { id: 'field-barcode', type: 'barcode' },
  { id: 'field-sequence', type: 'seq-number' },
];

const NAMING_FIELD_OPTIONS: Array<{ value: FileNamingFieldType; label: string }> = [
  { value: 'custom', label: 'Custom' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'seq-number', label: 'Seq Number' },
  { value: 'stream-name', label: 'Photo Op' },
  { value: 'stream-code', label: 'Photo Op Code' },
  { value: 'original-filename', label: 'Original File' },
  { value: 'date', label: 'Date' },
];

const PRINT_SIZES: Array<{ id: AutoPrintSize; label: string; sub: string }> = [
  { id: '4x6',    label: '4 × 6 in', sub: 'Postcard' },
  { id: '6x8',    label: '6 × 8 in', sub: 'Large' },
  { id: 'wallets', label: 'Wallets',  sub: '4-up · 2.5 × 3.5 in' },
];

interface TemplateEntry {
  id: string; name: string; meta: string;
  style: 'none' | 'classic' | 'polaroid' | 'safari' | 'strip' | 'banner' | 'caption';
}
interface TemplateSizeGroup { size: AutoPrintSize; sizeLabel: string; templates: TemplateEntry[]; }
interface TemplateCollection { id: string; label: string; desc: string; sizes: TemplateSizeGroup[]; }

const TEMPLATE_COLLECTIONS: TemplateCollection[] = [
  { id: 'main', label: 'Main Collection', desc: 'Default branded templates · year-round', sizes: [
    { size: '4x6', sizeLabel: '4 × 6 in', templates: [
      { id: 'tpl-main-4x6-1', name: 'Main 1',   meta: 'Classic matte',      style: 'classic'  },
      { id: 'tpl-main-4x6-2', name: 'Main 2',   meta: 'Polaroid · vintage', style: 'polaroid' },
    ]},
    { size: '6x8', sizeLabel: '6 × 8 in', templates: [
      { id: 'tpl-main-6x8-1', name: 'Main 1',   meta: 'Standard · centered', style: 'classic' },
      { id: 'tpl-main-6x8-2', name: 'Main 2',   meta: 'Logo banner top',     style: 'banner'  },
    ]},
    { size: 'wallets', sizeLabel: 'Wallets', templates: [
      { id: 'tpl-main-w-1', name: '4-up Sheet', meta: '2.5 × 3.5 in × 4',  style: 'strip'   },
    ]},
  ]},
  { id: 'holiday', label: 'Holiday Collection', desc: 'Seasonal · winter park', sizes: [
    { size: '4x6', sizeLabel: '4 × 6 in', templates: [
      { id: 'tpl-holiday-4x6-1', name: 'Winter',  meta: 'Frost + venue mark',  style: 'caption' },
    ]},
    { size: '6x8', sizeLabel: '6 × 8 in', templates: [
      { id: 'tpl-holiday-6x8-1', name: 'Holiday', meta: 'Seasonal headline',   style: 'caption' },
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

const ALL_TEMPLATES = TEMPLATE_COLLECTIONS.flatMap(c =>
  c.sizes.flatMap(s => s.templates.map(t => ({ ...t, collectionId: c.id, collectionLabel: c.label, size: s.size, sizeLabel: s.sizeLabel })))
);
const TEMPLATE_BY_ID = Object.fromEntries(ALL_TEMPLATES.map(t => [t.id, t]));

const DEFAULT_PRINT_ITEMS: AutoPrintItem[] = [
  { id: 'print-4x6-main',     quantity: 2, size: '4x6',    template: 'tpl-main-4x6-1',    templateSubline: '4 × 6 in' },
  { id: 'print-6x8-holiday',  quantity: 1, size: '6x8',    template: 'tpl-holiday-6x8-1', templateSubline: '6 × 8 in' },
  { id: 'print-wallets-main', quantity: 4, size: 'wallets', template: 'tpl-main-w-1',      templateSubline: 'Wallets'  },
];

function makeField(type: FileNamingFieldType = 'custom'): FileNamingField {
  return {
    id: `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    customText: type === 'custom' ? '' : undefined,
  };
}

function makePrintItem(): AutoPrintItem {
  return {
    id: `print-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    quantity: 1,
    size: '4x6',
    template: 'tpl-main-4x6-1',
    templateSubline: '4 × 6 in',
  };
}

function codeFromName(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return `XYZ-${(letters || 'OP').padEnd(3, 'X')}`;
}

function sanitizePreview(value: string): string {
  return value.trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]+/g, '') || 'TEXT';
}

function previewFilename(
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

function Toggle({ on, onChange, size = 'md' }: { on: boolean; onChange: () => void; size?: 'sm' | 'md' }) {
  return (
    <button
      className={`stream-toggle${size === 'sm' ? ' stream-toggle-sm' : ''}`}
      type="button"
      aria-pressed={on}
      onClick={onChange}
      title={on ? 'Disable' : 'Enable'}
    >
      <span />
    </button>
  );
}


// ── Template / size picker sub-components ──────────────────────────────────

type TemplateStyle = TemplateEntry['style'];

function TemplateThumb({ style, w = 28, h = 21 }: { style: TemplateStyle; w?: number; h?: number }) {
  const photo = '#2a2e35';
  const base: React.CSSProperties = { width: w, height: h, border: '1px solid var(--line)', flexShrink: 0, overflow: 'hidden', boxSizing: 'border-box' };
  if (style === 'none')     return <div style={{ ...base, background: photo }} />;
  if (style === 'classic')  return <div style={{ ...base, background: '#f8f8f8', padding: 3 }}><div style={{ width: '100%', height: '100%', background: photo }} /></div>;
  if (style === 'polaroid') return <div style={{ ...base, background: '#fff', display: 'flex', flexDirection: 'column', padding: '2px 2px 0 2px' }}><div style={{ flex: 1, background: photo }} /><div style={{ height: 4 }} /></div>;
  if (style === 'safari')   return <div style={{ ...base, background: '#f3e6c8', padding: 3 }}><div style={{ width: '100%', height: '100%', background: photo }} /></div>;
  if (style === 'strip')    return <div style={{ ...base, background: '#fff', display: 'flex', flexDirection: 'column', gap: 1.5, padding: 2 }}>{[0,1,2,3].map(i => <div key={i} style={{ flex: 1, background: photo }} />)}</div>;
  if (style === 'banner')   return <div style={{ ...base, background: '#0e0f11', display: 'flex', flexDirection: 'column' }}><div style={{ height: 4, background: 'linear-gradient(90deg,#3dd6c4,#1f6e64)' }} /><div style={{ flex: 1, background: photo }} /><div style={{ height: 3, background: '#16181c' }} /></div>;
  if (style === 'caption')  return <div style={{ ...base, background: '#fafafa', display: 'flex', flexDirection: 'column', padding: '2px 2px 0 2px' }}><div style={{ flex: 1, background: photo }} /><div style={{ height: 5 }} /></div>;
  return <div style={{ ...base, background: photo }} />;
}

function PrintSizeChip({ size }: { size: AutoPrintSize }) {
  const dims: Record<AutoPrintSize, [number, number]> = { '4x6': [16, 11], '6x8': [17, 13], wallets: [18, 13] };
  if (size === 'wallets') return (
    <div style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ width: 18, height: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1.5, padding: 1 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ background: 'var(--ink-3)', borderRadius: 0.5 }} />)}
      </div>
    </div>
  );
  const [bw, bh] = dims[size] ?? [16, 11];
  return (
    <div style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ width: bw, height: bh, background: 'var(--ink-3)', border: '1px solid var(--ink-2)' }} />
    </div>
  );
}

function useClickOutside(ref: React.RefObject<HTMLDivElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, ref, onClose]);
}

function PrintSizeSelect({ value, onChange }: { value: AutoPrintSize; onChange: (s: AutoPrintSize) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));
  const cur = PRINT_SIZES.find(s => s.id === value) ?? PRINT_SIZES[0];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="ap-select-trigger" onClick={() => setOpen(o => !o)}>
        <PrintSizeChip size={cur.id} />
        <span style={{ flex: 1, fontSize: 11.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur.label}</span>
        <ChevronDown size={12} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
      </div>
      {open && (
        <div className="ap-dropdown">
          {PRINT_SIZES.map(s => (
            <div key={s.id} className={`ap-dropdown-item${s.id === value ? ' active' : ''}`} onClick={() => { onChange(s.id); setOpen(false); }}>
              <PrintSizeChip size={s.id} />
              <div className="col" style={{ lineHeight: 1.15 }}>
                <span style={{ fontSize: 11.5 }}>{s.label}</span>
                <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-4)' }}>{s.sub}</span>
              </div>
              {s.id === value && <Check size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplatePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [activeCol, setActiveCol] = useState('main');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  const cur = TEMPLATE_BY_ID[value];
  const collection = TEMPLATE_COLLECTIONS.find(c => c.id === activeCol) ?? TEMPLATE_COLLECTIONS[0];
  const totalCount = ALL_TEMPLATES.length;

  const openPicker = () => {
    if (cur) setActiveCol(cur.collectionId);
    setOpen(o => !o);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="ap-select-trigger" onClick={openPicker}>
        <TemplateThumb style={cur?.style ?? 'classic'} />
        <div className="col" style={{ lineHeight: 1.15, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cur ? `${cur.collectionLabel.replace(' Collection', '').replace(' Edition', '')} · ${cur.name}` : (value || 'Select template')}
          </span>
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-4)' }}>{cur?.sizeLabel ?? ''}</span>
        </div>
        <ChevronDown size={12} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
      </div>
      {open && (
        <div className="ap-tpl-picker">
          <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', flexShrink: 0 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="uppercase">Choose Template</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{totalCount} templates · {TEMPLATE_COLLECTIONS.length} collections</span>
            </div>
          </div>

          <div className="ap-tpl-tabs">
            {TEMPLATE_COLLECTIONS.map(co => {
              const count = co.sizes.reduce((s, sz) => s + sz.templates.length, 0);
              const isSel = co.id === activeCol;
              const short = co.label.replace(' Collection', '').replace(' Edition', '').replace(' Strips', '');
              return (
                <button key={co.id} className={`ap-tpl-tab${isSel ? ' active' : ''}`} onClick={() => setActiveCol(co.id)}>
                  {short}
                  <span className={`ap-tpl-tab-count${isSel ? ' active' : ''}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div style={{ padding: '8px 12px 6px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 20, height: 20, borderRadius: 3, background: 'rgba(61,214,196,0.10)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
              <Layers size={11} />
            </div>
            <div className="col" style={{ lineHeight: 1.15, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}>{collection.label}</span>
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{collection.desc}</span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {collection.sizes.map(sz => (
              <div key={sz.size}>
                <div style={{ padding: '7px 12px 5px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 9.5, color: 'var(--accent)', letterSpacing: '0.14em', fontWeight: 600 }}>{sz.sizeLabel.toUpperCase()}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
                  <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-5)' }}>{sz.templates.length}</span>
                </div>
                {sz.templates.map(t => {
                  const isSel = t.id === value;
                  return (
                    <div key={t.id} className={`ap-tpl-row${isSel ? ' active' : ''}`} onClick={() => { onChange(t.id); setOpen(false); }}>
                      <TemplateThumb style={t.style} w={36} h={26} />
                      <div className="col" style={{ lineHeight: 1.15, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 11.5, color: isSel ? 'var(--accent)' : 'var(--ink)', fontWeight: isSel ? 500 : 400 }}>{t.name}</span>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{t.meta}</span>
                      </div>
                      {isSel && <Check size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ padding: '9px 12px', borderTop: '1px solid var(--line)', background: 'var(--bg-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>Manage in Configuration → Templates</span>
            <ChevronRight size={11} style={{ color: 'var(--ink-4)' }} />
          </div>
        </div>
      )}
    </div>
  );
}

const INSTALLED_PRINTERS = [
  { name: 'Epson SureColor P900', state: 'ready', sizes: '4×6 · 5×7 · 6×8 · 8×10' },
  { name: 'Epson SureLab D870',   state: 'ready', sizes: '4×6 · 6×8' },
  { name: 'Canon imagePROGRAF',   state: 'idle',  sizes: '8×10 · 11×14' },
  { name: 'DNP DS820A',           state: 'ready', sizes: '4×6 · wallets · strip' },
];

function PrinterSelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));
  const isAll = value === '__all__';
  const cur = INSTALLED_PRINTERS.find(p => p.name === value);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="ap-select-trigger" onClick={() => setOpen(o => !o)}>
        {isAll
          ? <Wifi size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          : <Printer size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />}
        <span style={{ flex: 1, fontSize: 11.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isAll ? 'All available printers' : (value || 'No printer')}
        </span>
        {isAll && <span className="mono" style={{ fontSize: 10, color: 'var(--ok)' }}>· broadcast</span>}
        {!isAll && cur && <span className="mono" style={{ fontSize: 10, color: cur.state === 'ready' ? 'var(--ok)' : 'var(--ink-4)' }}>· {cur.state}</span>}
        <ChevronDown size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
      </div>
      {open && (
        <div className="ap-dropdown ap-dropdown-up">
          <div className={`ap-dropdown-item${isAll ? ' active' : ''}`} onClick={() => { onChange('__all__'); setOpen(false); }}>
            <div style={{ width: 22, height: 22, borderRadius: 3, background: 'rgba(61,214,196,0.10)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
              <Wifi size={12} />
            </div>
            <div className="col" style={{ lineHeight: 1.15, flex: 1 }}>
              <span style={{ fontSize: 11.5, color: isAll ? 'var(--accent)' : 'var(--ink)', fontWeight: isAll ? 500 : 400 }}>All available printers</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>Route to whichever printer is idle · load-balanced</span>
            </div>
            {isAll && <Check size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
          </div>
          <div style={{ padding: '7px 10px 5px', background: 'var(--bg-2)', borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)' }}>
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--accent)', letterSpacing: '0.14em', fontWeight: 600 }}>INSTALLED PRINTERS</span>
          </div>
          {INSTALLED_PRINTERS.map(p => {
            const isSel = p.name === value;
            return (
              <div key={p.name} className={`ap-dropdown-item${isSel ? ' active' : ''}`} onClick={() => { onChange(p.name); setOpen(false); }}>
                <Printer size={13} style={{ color: isSel ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0 }} />
                <div className="col" style={{ lineHeight: 1.15, flex: 1, minWidth: 0 }}>
                  <div className="row gap-2">
                    <span style={{ fontSize: 11.5, color: isSel ? 'var(--accent)' : 'var(--ink)', fontWeight: isSel ? 500 : 400 }}>{p.name}</span>
                    <span className="mono" style={{ fontSize: 9.5, color: p.state === 'ready' ? 'var(--ok)' : 'var(--ink-4)' }}>· {p.state}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{p.sizes}</span>
                </div>
                {isSel && <Check size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Auto-Print Setup Dialog ─────────────────────────────────────────────────

function AutoPrintSetupDialog({ stream, onClose }: { stream: ImageStream; onClose: () => void }) {
  const { updateImageStream } = useApp();
  const [items, setItems] = useState<AutoPrintItem[]>(stream.autoPrintItems?.length ? stream.autoPrintItems : DEFAULT_PRINT_ITEMS);
  const [printerName, setPrinterName] = useState(stream.printerName ?? 'Epson SureColor P900');

  const totalPrints = items.reduce((sum, item) => sum + Math.max(0, item.size === 'wallets' ? item.quantity * 4 : item.quantity), 0);
  const estimateSeconds = (totalPrints * 1.8).toFixed(1);
  const isAllPrinters = printerName === '__all__';

  const updateItem = (id: string, changes: Partial<AutoPrintItem>) => {
    setItems(current => current.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, ...changes };
      if (changes.size) next.templateSubline = PRINT_SIZES.find(s => s.id === changes.size)?.label ?? changes.size;
      return next;
    }));
  };

  const save = async () => {
    await updateImageStream(stream.id, { autoPrintEnabled: true, autoPrintItems: items, printerName });
    onClose();
  };

  return (
    <div className="stream-modal-backdrop">
      <div className="autoprint-modal">
        {/* Header */}
        <div className="stream-modal-head">
          <div className="stream-icon" style={{ color: 'var(--accent)' }}><Printer size={15} /></div>
          <div className="col grow" style={{ lineHeight: 1.15 }}>
            <div className="row gap-2">
              <strong style={{ fontSize: 13 }}>Auto-Print Setup</strong>
              <span style={{ color: 'var(--ink-5)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{stream.name}</span>
              <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{stream.code ?? stream.slug.toUpperCase()}</span>
            </div>
            <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>For each new capture, queue these print items.</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Body */}
        <div className="autoprint-body">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span className="uppercase">Print Items</span>
            <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{items.length} item{items.length === 1 ? '' : 's'} per capture</span>
          </div>

          {/* Table header */}
          <div className="autoprint-table-head">
            <span>#</span>
            <span>QTY</span>
            <span>PRINT SIZE</span>
            <span>TEMPLATE</span>
            <span />
          </div>

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((item, index) => (
              <div className="autoprint-row" key={item.id}>
                <span className="mono" style={{ textAlign: 'center' }}>{index + 1}</span>
                <div className="qty-stepper">
                  <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}>
                    <Minus size={11} />
                  </button>
                  <strong style={{ textAlign: 'center' }}>{item.quantity}</strong>
                  <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => updateItem(item.id, { quantity: Math.min(99, item.quantity + 1) })}>
                    <Plus size={11} />
                  </button>
                </div>
                <PrintSizeSelect value={item.size} onChange={size => updateItem(item.id, { size })} />
                <TemplatePicker value={item.template} onChange={template => updateItem(item.id, { template })} />
                <button className="icon-btn" style={{ width: 24, height: 24, color: 'var(--ink-4)' }} title="Remove item" disabled={items.length <= 1} onClick={() => setItems(current => current.filter(c => c.id !== item.id))}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-4)', fontSize: 11.5, border: '1px dashed var(--line)', borderRadius: 3 }} className="mono">
                No print items. Add one below to start auto-printing.
              </div>
            )}
          </div>

          <button className="btn ghost autoprint-add" onClick={() => setItems(current => [...current, makePrintItem()])}>
            <Plus size={12} /> Add print item
          </button>

          <div className="divider" style={{ margin: '4px 0' }} />

          {/* Routing */}
          <div className="autoprint-routing">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span className="uppercase">Print Routing</span>
              <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{isAllPrinters ? '4 printers · load-balanced' : '1 printer'}</span>
            </div>
            <PrinterSelect value={printerName} onChange={setPrinterName} />
          </div>
        </div>

        {/* Footer */}
        <div className="stream-modal-foot">
          <Info size={12} style={{ color: 'var(--ink-4)' }} />
          <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 10.5 }}>
            <span style={{ color: 'var(--accent)' }}>{totalPrints}</span> prints per capture
            <span style={{ color: 'var(--ink-5)' }}> · </span>
            est. <span style={{ color: 'var(--ink)' }}>{estimateSeconds}s</span>
            <span style={{ color: 'var(--ink-5)' }}> · </span>
            queue depth <span style={{ color: 'var(--ink)' }}>3</span>
          </span>
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => void save()}>
            <Check size={12} strokeWidth={2.4} /> Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface FolderFileEntry {
  name: string;
  size: number;
  modified_ms: number | null;
}

function StreamCard({ stream, isSelected, onSelect }: { stream: ImageStream; isSelected: boolean; onSelect: (id: string) => void }) {
  const { updateImageStream, importQueue } = useApp();
  const [autoPrintOpen, setAutoPrintOpen] = useState(false);
  const [folderFiles, setFolderFiles] = useState<FolderFileEntry[]>([]);
  const isDesktop = isTauriRuntime();
  const sparkData = useMemo(() => computeSparkline(stream.id, importQueue), [stream.id, importQueue]);

  useEffect(() => {
    if (!isDesktop || !stream.watchPath) {
      setFolderFiles([]);
      return;
    }
    const poll = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const files = await invoke<FolderFileEntry[]>('list_folder_files', { path: stream.watchPath });
        setFolderFiles(files);
      } catch {
        setFolderFiles([]);
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 2000);
    return () => clearInterval(interval);
  }, [isDesktop, stream.watchPath]);
  const color = statusColor(stream.status, stream.enabled);

  return (
    <div
      className={`stream-card${isSelected ? ' stream-card-selected' : ''}${!stream.enabled ? ' stream-card-inactive' : ''}`}
      onClick={() => onSelect(stream.id)}
    >
      {stream.enabled && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.55 }} />
      )}

      {/* Header */}
      <div className="row" style={{ gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="stream-icon" style={{ color, background: stream.enabled ? 'rgba(61,214,196,0.10)' : 'var(--bg-3)' }}>
          <MapPin size={14} />
        </div>
        <div className="col grow" style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div className="row gap-2" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stream.name}</span>
          </div>
          <div className="row gap-1 mono" style={{ fontSize: 9.5, marginTop: 2, letterSpacing: '0.04em' }}>
            <span className="stream-dot" style={{
              background: color,
              boxShadow: stream.enabled ? `0 0 0 2px ${stream.status === 'error' || stream.status === 'review' ? 'rgba(232,176,74,0.18)' : 'rgba(98,200,122,0.18)'}` : 'none',
              animation: stream.enabled ? 'streamPulse 1.8s ease-in-out infinite' : 'none',
            }} />
            <span style={{ color }}>{statusLabel(stream.status, stream.enabled).toUpperCase()}</span>
            {stream.enabled && stream.filesPerMinute != null && (
              <><span style={{ color: 'var(--ink-5)' }}>·</span><span style={{ color: 'var(--ink-3)' }}>{stream.filesPerMinute}/min</span></>
            )}
          </div>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <Toggle on={stream.enabled} onChange={() => void updateImageStream(stream.id, { enabled: !stream.enabled })} />
        </div>
      </div>

      {/* Folder path */}
      <div className="row" style={{ padding: '7px 12px', gap: 8, borderBottom: '1px solid var(--line-soft)', background: 'var(--bg)' }}>
        <Folder size={12} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
        <span
          className="mono grow"
          title={stream.watchPath ?? undefined}
          style={{ color: stream.watchPath ? 'var(--ink-3)' : 'var(--ink-4)', fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}
        >
          {stream.watchPath ?? 'No folder selected'}
        </span>
        {stream.watchPath && isDesktop && (
          <button
            className="icon-btn"
            style={{ width: 22, height: 22, flexShrink: 0 }}
            title="Open folder in Explorer"
            onClick={e => { e.stopPropagation(); void openInExplorer(stream.watchPath!); }}
          >
            <FolderOpen size={12} />
          </button>
        )}
      </div>

      {/* Counters + sparkline */}
      <div className="row" style={{ padding: '9px 12px', gap: 10, borderBottom: '1px solid var(--line-soft)' }}>
        <div className="col" style={{ flex: 1, gap: 2 }}>
          <div className="row" style={{ gap: 14 }}>
            <div className="col" style={{ lineHeight: 1.05 }}>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{stream.totalDetected}</span>
              <span className="mono" style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--ink-4)' }}>IN</span>
            </div>
            <div className="col" style={{ lineHeight: 1.05 }}>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ok)' }}>{stream.totalImported}</span>
              <span className="mono" style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--ink-4)' }}>OK</span>
            </div>
            <div className="col" style={{ lineHeight: 1.05 }}>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: stream.totalFailed ? 'var(--warn)' : 'var(--ink-4)' }}>{stream.totalFailed}</span>
              <span className="mono" style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--ink-4)' }}>ERR</span>
            </div>
          </div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
          <Sparkline data={sparkData} width={92} height={22} />
          <span className="mono" style={{ fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>FILES / MIN · 30m</span>
        </div>
      </div>

      {/* Watcher directory — live folder view */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#0a0b0d' }}>
        <div className="row" style={{ padding: '6px 10px', borderBottom: '1px solid var(--line-soft)', gap: 8 }}>
          <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--ink-4)' }}>WATCHER DIRECTORY</span>
          <span className="grow" />
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-5)' }}>NAME · MODIFIED · SIZE</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {!isDesktop || !stream.watchPath ? (
            <div className="mono" style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 10.5 }}>— desktop only —</div>
          ) : folderFiles.length === 0 ? (
            <div className="mono" style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 10.5 }}>— folder empty —</div>
          ) : folderFiles.slice(0, 8).map(file => (
            <div key={file.name} className="stream-file-row" onClick={e => e.stopPropagation()}>
              <span className="mono stream-file-name">
                <FileImage size={10} style={{ color: 'var(--ink-4)', verticalAlign: -1, marginRight: 4, flexShrink: 0 }} />
                {file.name}
              </span>
              <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10, textAlign: 'right' }}>
                {file.modified_ms != null ? fmtTime(new Date(file.modified_ms).toISOString()) : '—'}
              </span>
              <span className="mono" style={{ color: 'var(--ink-5)', fontSize: 10, textAlign: 'right' }}>
                {`${(file.size / (1024 * 1024)).toFixed(1)} MB`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Auto-print footer */}
      <div className="autoprint-strip" onClick={e => e.stopPropagation()}>
        <Printer size={13} style={{ color: stream.autoPrintEnabled ? 'var(--accent)' : 'var(--ink-4)', flexShrink: 0 }} />
        <div className="col grow" style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div className="row gap-2">
            <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>Auto-print</span>
            <span className="mono" style={{ fontSize: 9.5, color: stream.autoPrintEnabled ? 'var(--accent)' : 'var(--ink-4)', letterSpacing: '0.08em' }}>{stream.autoPrintEnabled ? 'ON' : 'OFF'}</span>
          </div>
          <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 9.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stream.printerName ?? 'Epson SureColor P900'} · <span style={{ color: stream.autoPrintEnabled ? 'var(--ok)' : 'var(--ink-3)' }}>{stream.autoPrintEnabled ? 'ready' : 'idle'}</span>
          </span>
        </div>
        <button className="icon-btn" style={{ width: 24, height: 24 }} title="Auto-print settings" onClick={() => setAutoPrintOpen(true)}>
          <Settings size={13} />
        </button>
        <Toggle on={stream.autoPrintEnabled ?? false} onChange={() => void updateImageStream(stream.id, { autoPrintEnabled: !(stream.autoPrintEnabled ?? false) })} size="sm" />
      </div>
      {autoPrintOpen && <AutoPrintSetupDialog stream={stream} onClose={() => setAutoPrintOpen(false)} />}
    </div>
  );
}

function PhotoOpDialog({ open, stream, onClose }: { open: boolean; stream?: ImageStream | null; onClose: () => void }) {
  const { createImageStream, updateImageStream, deleteImageStream } = useApp();
  const [name, setName] = useState(stream?.name ?? '');
  const [watchPath, setWatchPath] = useState(stream?.watchPath ?? '');
  const [processingPreset, setProcessingPreset] = useState(stream?.processingPreset ?? 'Default - Background removal + Enhance');
  const [printerName, setPrinterName] = useState(stream?.printerName ?? 'Epson SureColor P900');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(stream?.autoPrintEnabled ?? true);
  const [autoPrintItems, setAutoPrintItems] = useState<AutoPrintItem[]>(stream?.autoPrintItems?.length ? stream.autoPrintItems : DEFAULT_PRINT_ITEMS);
  const [enabled, setEnabled] = useState(stream?.enabled ?? true);
  const [fileRenamingEnabled, setFileRenamingEnabled] = useState(stream?.fileRenamingEnabled ?? false);
  const [fileNamingFields, setFileNamingFields] = useState<FileNamingField[]>(stream?.fileNamingFields?.length ? stream.fileNamingFields : DEFAULT_NAMING_FIELDS);
  const [fileNamingSeparator, setFileNamingSeparator] = useState<FileNamingSeparator>(stream?.fileNamingSeparator ?? '_');
  const [fileNamingExtension, setFileNamingExtension] = useState<FileNamingExtension>(stream?.fileNamingExtension ?? 'JPG');
  const [error, setError] = useState('');
  const isDesktop = isTauriRuntime();
  const isEditing = Boolean(stream);
  const code = stream?.code ?? codeFromName(name);

  useEffect(() => {
    if (!open) return;
    setName(stream?.name ?? '');
    setWatchPath(stream?.watchPath ?? '');
    setProcessingPreset(stream?.processingPreset ?? 'Default - Background removal + Enhance');
    setPrinterName(stream?.printerName ?? 'Epson SureColor P900');
    setAutoPrintEnabled(stream?.autoPrintEnabled ?? true);
    setAutoPrintItems(stream?.autoPrintItems?.length ? stream.autoPrintItems : DEFAULT_PRINT_ITEMS);
    setEnabled(stream?.enabled ?? true);
    setFileRenamingEnabled(stream?.fileRenamingEnabled ?? false);
    setFileNamingFields(stream?.fileNamingFields?.length ? stream.fileNamingFields : DEFAULT_NAMING_FIELDS);
    setFileNamingSeparator(stream?.fileNamingSeparator ?? '_');
    setFileNamingExtension(stream?.fileNamingExtension ?? 'JPG');
    setError('');
  }, [open, stream]);

  if (!open) return null;

  const canCreate = name.trim().length > 0 && watchPath.trim().length > 0;

  const browse = async () => {
    if (!isDesktop) return;
    const dialog = await import('@tauri-apps/plugin-dialog');
    const selected = await dialog.open({ directory: true, multiple: false });
    if (typeof selected === 'string') setWatchPath(selected);
  };

  const save = async () => {
    if (!canCreate) {
      setError('Fill name and a folder path.');
      return;
    }
    if (stream) {
      await updateImageStream(stream.id, {
        name,
        code,
        watchPath,
        enabled,
        processingPreset,
        printerName,
        autoPrintEnabled,
        autoPrintItems,
        fileRenamingEnabled,
        fileNamingFields,
        fileNamingSeparator,
        fileNamingExtension,
      });
    } else {
      await createImageStream({
        name,
        code,
        watchPath,
        enabled,
        processingPreset,
        printerName,
        autoPrintEnabled,
        autoPrintItems,
        fileRenamingEnabled,
        fileNamingFields,
        fileNamingSeparator,
        fileNamingExtension,
      });
    }
    setName('');
    setWatchPath('');
    setProcessingPreset('Default - Background removal + Enhance');
    setPrinterName('Epson SureColor P900');
    setAutoPrintEnabled(true);
    setAutoPrintItems(DEFAULT_PRINT_ITEMS);
    setEnabled(true);
    setFileRenamingEnabled(false);
    setFileNamingFields(DEFAULT_NAMING_FIELDS);
    setFileNamingSeparator('_');
    setFileNamingExtension('JPG');
    setError('');
    onClose();
  };

  const updateNamingField = (id: string, changes: Partial<FileNamingField>) => {
    setFileNamingFields(fields => fields.map(field => (
      field.id === id
        ? { ...field, ...changes, customText: changes.type && changes.type !== 'custom' ? undefined : changes.customText ?? field.customText }
        : field
    )));
  };

  const removeNamingField = (id: string) => {
    setFileNamingFields(fields => fields.length <= 1 ? fields : fields.filter(field => field.id !== id));
  };

  const confirmDelete = async () => {
    if (!stream) return;
    const warning = [
      `DELETE PHOTO OP: ${stream.name}`,
      '',
      'This will permanently remove this Image Streams card and its photo-op configuration from PhotoFlow.',
      'Photo files and already-imported sessions will NOT be deleted, but this stream will no longer be available as a configured inbound source.',
      '',
      'Type DELETE to confirm.',
    ].join('\n');
    if (window.prompt(warning) !== 'DELETE') return;
    await deleteImageStream(stream.id);
    onClose();
  };

  return (
    <div className="stream-modal-backdrop">
      <div className="stream-modal">
        <div className="stream-modal-head">
          <div className="stream-icon" style={{ color: 'var(--accent)' }}><Plus size={15} /></div>
          <div className="col grow" style={{ lineHeight: 1.15 }}>
            <strong>{isEditing ? 'Photo Op Settings' : 'Add New Photo Op'}</strong>
            <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{isEditing ? 'Edit stream settings, watcher folder and delete options.' : 'Define a capture location and the folder it should watch.'}</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="stream-modal-body">
          <div className="stream-form-grid stream-form-grid-single">
            <label className="stream-field">
              <span>NAME <small>visible everywhere</small></span>
              <input value={name} onChange={event => setName(event.target.value)} placeholder="Lion Cubs" />
            </label>
          </div>

          <label className="stream-field">
            <span>WATCHER FOLDER <small>auto-monitored</small></span>
            <div className="stream-folder-input">
              <FolderOpen size={13} />
              <input value={watchPath} onChange={event => setWatchPath(event.target.value)} placeholder={isDesktop ? 'C:\\PhotoFlow Intake\\Lion Cubs' : 'Desktop-only folder path'} />
              <button className="btn" disabled={!isDesktop} onClick={() => void browse()}>Browse...</button>
            </div>
          </label>

          <div className="file-naming-panel">
            <div className="file-naming-head">
              <div>
                <span className="uppercase">File Renaming</span>
                <div className="mono">{fileRenamingEnabled ? 'rename on import' : 'keep existing filename on import'}</div>
              </div>
              <Toggle on={fileRenamingEnabled} onChange={() => setFileRenamingEnabled(value => !value)} />
            </div>
            {fileRenamingEnabled ? (
              <>
                <div className="file-naming-section-title">Naming Fields</div>
                <div className="naming-fields">
                  {fileNamingFields.map((field, index) => (
                    <div className="naming-field-row" key={field.id}>
                      <span className="mono">FIELD {index + 1}</span>
                      <select
                        value={field.type}
                        onChange={event => updateNamingField(field.id, { type: event.target.value as FileNamingFieldType })}
                      >
                        {NAMING_FIELD_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {field.type === 'custom' && (
                        <input
                          value={field.customText ?? ''}
                          onChange={event => updateNamingField(field.id, { customText: event.target.value })}
                          placeholder="Enter text..."
                        />
                      )}
                      <button className="icon-btn" title="Remove field" onClick={() => removeNamingField(field.id)} disabled={fileNamingFields.length <= 1}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn ghost file-add-field" onClick={() => setFileNamingFields(fields => [...fields, makeField('barcode')])}>
                  <Plus size={12} /> Add Field
                </button>
                <div className="file-option-row">
                  <span>Separator</span>
                  <div className="segmented-mini">
                    {(['-', '.', '_'] as FileNamingSeparator[]).map(separator => (
                      <button
                        key={separator}
                        className={fileNamingSeparator === separator ? 'active' : ''}
                        onClick={() => setFileNamingSeparator(separator)}
                      >
                        {separator}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="file-option-row">
                  <span>Extension</span>
                  <div className="segmented-mini wide">
                    {(['JPG', 'DNG', 'RAW'] as FileNamingExtension[]).map(extension => (
                      <button
                        key={extension}
                        className={fileNamingExtension === extension ? 'active' : ''}
                        onClick={() => setFileNamingExtension(extension)}
                      >
                        {extension}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="file-preview">
                  <span>Preview</span>
                  <strong className="mono">{previewFilename(fileNamingFields, fileNamingSeparator, fileNamingExtension, name, code)}</strong>
                </div>
              </>
            ) : (
              <div className="file-renaming-off mono">Imported photos keep the exact detected filename.</div>
            )}
          </div>

          <label className="stream-field">
            <span>PROCESSING PRESET</span>
            <select value={processingPreset} onChange={event => setProcessingPreset(event.target.value)}>
              <option>Default - Background removal + Enhance</option>
              <option>Import only - no processing</option>
              <option>Background removal only</option>
              <option>Enhance only</option>
            </select>
          </label>

          <div className="stream-form-grid">
            <label className="stream-field stream-field-wide">
              <span>PRINTER</span>
              <div className="stream-folder-input">
                <Printer size={13} />
                <select value={printerName} onChange={event => setPrinterName(event.target.value)}>
                  <option>Epson SureColor P900</option>
                  <option>Canon imagePROGRAF</option>
                  <option>DNP DS820A</option>
                  <option>No printer</option>
                </select>
              </div>
            </label>
            <div className="stream-create-toggles">
              <div className="uppercase">On Creation</div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Auto-print</span>
                <Toggle on={autoPrintEnabled} onChange={() => setAutoPrintEnabled(value => !value)} />
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Enable stream</span>
                <Toggle on={enabled} onChange={() => setEnabled(value => !value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="stream-modal-foot">
          <span className="mono" style={{ color: error ? 'var(--warn)' : 'var(--ink-4)', fontSize: 10.5 }}>{error || 'Fill name and a folder path.'}</span>
          {isEditing && (
            <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={() => void confirmDelete()}>
              <Trash2 size={13} /> Delete Photo Op
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canCreate} onClick={() => void save()}>
            <Plus size={13} /> {isEditing ? 'Save Photo Op' : 'Create Photo Op'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImageStreamsCenter() {
  const { imageStreams, importQueue } = useApp();
  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [settingsStream, setSettingsStream] = useState<ImageStream | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const filtered = imageStreams.filter(stream => (
    `${stream.name} ${stream.slug} ${stream.code ?? ''}`.toLowerCase().includes(query.toLowerCase())
  ));
  const active = imageStreams.filter(stream => stream.enabled).length;
  const withFolders = imageStreams.filter(stream => Boolean(stream.watchPath)).length;
  const ingestedToday = useMemo(() => {
    const today = new Date();
    return importQueue.filter(item => {
      if (item.status !== 'complete' || !item.importedAt) return false;
      const imported = new Date(item.importedAt);
      return imported.getFullYear() === today.getFullYear() &&
        imported.getMonth() === today.getMonth() &&
        imported.getDate() === today.getDate();
    }).length;
  }, [importQueue]);

  return (
    <div className="panel center stream-page">
      <div className="stream-rail">
        <div className="panel-section">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="uppercase">Photo Ops</div>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{active} active · {imageStreams.length} total</span>
          </div>
        </div>
        <div className="panel-scroll grow">
          {imageStreams.length === 0 ? (
            <div style={{ padding: '20px 12px', color: 'var(--ink-4)', fontSize: 11, lineHeight: 1.4 }}>
              Add a photo op to create the first inbound stream.
            </div>
          ) : (
            imageStreams.map(stream => (
              <div key={stream.id} className="stream-rail-row">
                <span className="stream-dot" style={{ background: statusColor(stream.status, stream.enabled) }} />
                <div className="col grow" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stream.name}</span>
                  <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{stream.totalImported} files</span>
                </div>
                <button className="icon-btn" title={`Configure ${stream.name}`} onClick={() => setSettingsStream(stream)}>
                  <Settings size={12} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="panel-section stream-rail-footer">
          <button className="btn primary block" onClick={() => setIsAdding(true)}>
            <Plus size={13} /> Add New Photo Op
          </button>
          <div className="mono" style={{ color: 'var(--ink-4)', fontSize: 10, marginTop: 10, lineHeight: 1.35 }}>
            New ops appear instantly across local ingest.
          </div>
        </div>
      </div>

      <div className="stream-main">
        <div className="stream-header">
          <div className="col">
            <div className="row gap-2">
              <span className="uppercase">Image Streams</span>
              <span className="pill accent mono">{active} active</span>
            </div>
            <div className="mono" style={{ color: 'var(--ink-4)', fontSize: 10.5, marginTop: 4 }}>
              {imageStreams.length} streams · {withFolders} folders · {ingestedToday} imported today
            </div>
          </div>
          <div className="grow" />
          <button className="btn ghost"><Filter size={13} /> Filter</button>
          <button className="btn ghost"><ArrowUpDown size={13} /> Sort</button>
          <div className="vdivider" style={{ height: 22 }} />
          <button className="btn ghost"><Grid3X3 size={13} /> Grid</button>
          <div className="search-bar">
            <Search size={12} style={{ color: 'var(--ink-4)' }} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search streams..." />
          </div>
          <button className="btn ghost"><RefreshCw size={13} /> Refresh all</button>
        </div>

        {filtered.length === 0 ? (
          <div className="stream-empty" />
        ) : (
          <div className="stream-grid">
            {filtered.map(stream => (
              <StreamCard
                key={stream.id}
                stream={stream}
                isSelected={selectedStreamId === stream.id}
                onSelect={setSelectedStreamId}
              />
            ))}
          </div>
        )}
      </div>
      <PhotoOpDialog open={isAdding} onClose={() => setIsAdding(false)} />
      <PhotoOpDialog open={settingsStream != null} stream={settingsStream} onClose={() => setSettingsStream(null)} />
    </div>
  );
}
