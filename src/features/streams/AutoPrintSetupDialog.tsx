import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  Minus,
  Plus,
  Printer,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { AutoPrintItem, AutoPrintSize, ImageStream } from '../../data/models';
import {
  ALL_TEMPLATES,
  DEFAULT_PRINT_ITEMS,
  INSTALLED_PRINTERS,
  PRINT_SIZES,
  TEMPLATE_BY_ID,
  TEMPLATE_COLLECTIONS,
  makePrintItem,
} from './streamUiHelpers';
import type { TemplateEntry } from './streamUiHelpers';

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

export function AutoPrintSetupDialog({ stream, onClose }: { stream: ImageStream; onClose: () => void }) {
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

        <div className="autoprint-body">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span className="uppercase">Print Items</span>
            <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{items.length} item{items.length === 1 ? '' : 's'} per capture</span>
          </div>

          <div className="autoprint-table-head">
            <span>#</span>
            <span>QTY</span>
            <span>PRINT SIZE</span>
            <span>TEMPLATE</span>
            <span />
          </div>

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

          <div className="autoprint-routing">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span className="uppercase">Print Routing</span>
              <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{isAllPrinters ? '4 printers · load-balanced' : '1 printer'}</span>
            </div>
            <PrinterSelect value={printerName} onChange={setPrinterName} />
          </div>
        </div>

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
