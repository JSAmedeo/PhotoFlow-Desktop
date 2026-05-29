import { useRef, useEffect, useState, memo, useCallback } from 'react';
import {
  Maximize2, Paintbrush, Eraser, Wand2, Hand, ZoomOut, ZoomIn,
  Undo2, Redo2, Crop, Upload, Check, Trash2, Columns2, Sparkles, Save,
} from 'lucide-react';
import { HourFilmstrip } from './HourFilmstrip';
import { useApp } from '../../context/AppContext';
import type { PhotoVersion } from '../../data/models';
import { confirmDestructive } from '../../utils/confirm';
import { isTauriRuntime } from '../../runtime/runtime';
import { updatePhotoMetadata } from '../../data/repository';

interface CenterPanelProps {
  visible:        boolean;
  activePhoto:    number;
  setActivePhoto: (i: number) => void;
  split:          number;
  setSplit:       (s: number) => void;
  zoom:           number;
  setZoom:        (z: number) => void;
  activeTool:     string;
  setActiveTool:  (t: string) => void;
}

const SessionPhotoMini = memo(function SessionPhotoMini({
  idx, active, selected, status, src, fallbackSrc, filename,
}: { idx: number; active: boolean; selected: boolean; status: string; src: string; fallbackSrc?: string; filename: string }) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { setImgSrc(src); setHidden(false); }, [src]);

  return (
    <div className={`session-thumb ${active ? 'active' : ''}`} style={{ boxShadow: selected ? '0 0 0 2px rgba(61,214,196,0.55)' : undefined }}>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <img
          src={imgSrc}
          alt={filename || `Frame ${idx}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: hidden ? 'none' : 'block' }}
          onError={() => {
            if (fallbackSrc && imgSrc !== fallbackSrc) setImgSrc(fallbackSrc);
            else setHidden(true);
          }}
        />
      </div>
      <div className="st-tag">{`#${String(idx).padStart(2, '0')}`}</div>
      {selected && (
        <div style={{
          position: 'absolute', top: 4, right: 4, width: 15, height: 15, borderRadius: 3,
          background: 'var(--accent)', color: '#04211f', display: 'grid', placeItems: 'center',
        }}>
          <Check size={10} strokeWidth={3} />
        </div>
      )}
      {status === 'done'       && <div className="st-ok"><Check size={9} strokeWidth={3} /></div>}
      {status === 'processing' && <div className="st-warn" style={{ background: 'var(--accent)' }} />}
      {status === 'warn'       && <div className="st-warn" />}
    </div>
  );
});

export function CenterPanel({
  visible, activePhoto, setActivePhoto, split, setSplit, zoom, setZoom, activeTool, setActiveTool,
}: CenterPanelProps) {
  const {
    sessions, photos, selectedSessionId, selectedPhotoId, selectedPhotoIds,
    selectPhoto, togglePhotoSelection, selectPhotoRange, deleteSelectedPhotos,
    getPhotoVersions, refreshPhotoInPlace,
  } = useApp();
  const session = sessions.find(s => s.id === selectedSessionId) ?? sessions[0];
  const selectedIndex = Math.max(0, photos.findIndex(p => p.id === selectedPhotoId));
  const currentIndex = photos[activePhoto - 1] ? activePhoto - 1 : selectedIndex;
  const currentPhoto = photos[currentIndex] ?? photos[0];
  const selectedCount = selectedPhotoIds.length;
  const wrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [compareMode, setCompareMode] = useState(true);
  const [versions, setVersions] = useState<PhotoVersion[]>([]);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [saving, setSaving] = useState(false);
  const [afterUrlFailed, setAfterUrlFailed] = useState(false);
  const [singleUrlFailed, setSingleUrlFailed] = useState(false);

  // Load versions when photo changes.
  useEffect(() => {
    if (!currentPhoto?.id) { setVersions([]); return; }
    void getPhotoVersions(currentPhoto.id).then(setVersions);
  }, [currentPhoto?.id, currentPhoto?.processingStatus, getPhotoVersions]);

  // Poll for photo refresh while enhancement is running.
  useEffect(() => {
    if (currentPhoto?.processingStatus !== 'processing') return;
    const id = setInterval(() => {
      void refreshPhotoInPlace(currentPhoto.id).then(() => {
        // Versions reload via the processingStatus dependency above once status changes.
      });
    }, 1500);
    return () => clearInterval(id);
  }, [currentPhoto?.id, currentPhoto?.processingStatus, refreshPhotoInPlace]);

  const hasEnhanced = versions.some(v => v.kind === 'enhanced');
  const isProcessing = currentPhoto?.processingStatus === 'processing';

  const beforeUrl = currentPhoto?.beforeImageUrl ?? currentPhoto?.displayUrl ?? '/demo-assets/before.jpg';
  const afterUrl  = currentPhoto?.afterImageUrl  ?? beforeUrl;
  const effectiveAfterUrl  = afterUrlFailed  ? beforeUrl : afterUrl;
  const effectiveSingleUrl = singleUrlFailed ? beforeUrl : (currentPhoto?.displayUrl ?? beforeUrl);

  // Reset image fallback state when the photo or its URLs change.
  useEffect(() => { setAfterUrlFailed(false); }, [afterUrl]);
  useEffect(() => { setSingleUrlFailed(false); }, [currentPhoto?.id]);

  // Auto-enable compare mode when an enhanced version becomes available.
  useEffect(() => {
    if (versions.some(v => v.kind === 'enhanced')) {
      setCompareMode(true);
    }
  }, [versions]);

  const adjustmentsActive = brightness !== 0 || contrast !== 0 || saturation !== 0;
  const imgFilter = adjustmentsActive
    ? `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100})`
    : undefined;

  // Left corner label = what you see when handle is all the way left (ORIGINAL).
  // Right corner label = what you see when handle is all the way right (ENHANCED).
  const leftLabel  = 'ORIGINAL';
  const rightLabel = hasEnhanced
    ? 'ENHANCED ✦'
    : isProcessing
      ? 'ENHANCING…'
      : adjustmentsActive
        ? 'ADJUSTED'
        : 'ORIGINAL';

  const updateSplit = useCallback((e: MouseEvent) => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setSplit(Math.max(2, Math.min(98, ((e.clientX - r.left) / r.width) * 100)));
  }, [setSplit]);

  const saveAdjustments = useCallback(async () => {
    if (!adjustmentsActive || !currentPhoto?.id || !isTauriRuntime()) return;
    const enhancedVersion = versions.find(v => v.kind === 'enhanced');
    const storagePath = enhancedVersion?.storagePath ?? currentPhoto?.storagePath;
    if (!storagePath) return;
    setSaving(true);
    try {
      const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
      await invoke('apply_photo_adjustments', { inputPath: storagePath, brightness, contrast, saturation });
      const newUrl = convertFileSrc(storagePath) + '?t=' + Date.now();
      await updatePhotoMetadata(currentPhoto.id, { displayUrl: newUrl, afterImageUrl: newUrl });
      await refreshPhotoInPlace(currentPhoto.id);
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
    } finally {
      setSaving(false);
    }
  }, [adjustmentsActive, currentPhoto, versions, brightness, contrast, saturation, refreshPhotoInPlace]);

  useEffect(() => {
    const m = (e: MouseEvent) => { if (draggingRef.current) updateSplit(e); };
    const u = () => { draggingRef.current = false; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', m);
    window.addEventListener('mouseup', u);
    return () => { window.removeEventListener('mousemove', m); window.removeEventListener('mouseup', u); };
  }, [updateSplit]);

  useEffect(() => {
    if (selectedIndex >= 0 && activePhoto !== selectedIndex + 1) {
      setActivePhoto(selectedIndex + 1);
    }
  }, [activePhoto, selectedIndex, setActivePhoto]);

  const tools = [
    { key: 'brush',  icon: <Paintbrush size={14} />, label: 'Brush'      },
    { key: 'lasso',  icon: <span style={{ fontSize: 12 }}>⌖</span>, label: 'Lasso' },
    { key: 'eraser', icon: <Eraser size={14} />,     label: 'Eraser'     },
    { key: 'wand',   icon: <Wand2 size={14} />,      label: 'Magic Wand' },
  ];

  if (!visible) return <div className="panel center" />;
  if (!session) return <div className="panel center" />;

  return (
    <div className="panel center">
      <HourFilmstrip />

      {/* Workbench */}
      <div className="workbench">
        <div className="compare-wrap">
          <div
            className="compare"
            ref={wrapRef}
            style={{ width: '100%', height: '100%', '--split': `${split}%` } as React.CSSProperties}
          >
            {compareMode ? (
              <>
                {/* Before pane — ENHANCED (left side, grows as handle moves right) + CSS adjustments */}
                <div className="pane before">
                  <img
                    src={effectiveAfterUrl}
                    alt="Enhanced"
                    onLoad={() => setImgLoaded(true)}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: imgFilter }}
                    onError={() => setAfterUrlFailed(true)}
                  />
                  {isProcessing && !hasEnhanced && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.35)',
                    }}>
                      <Sparkles size={22} style={{ color: 'var(--accent)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </div>
                  )}
                </div>

                {/* After pane — ORIGINAL (right side, revealed by dragging handle left) — no filter */}
                <div className="pane after">
                  <img
                    src={beforeUrl}
                    alt="Original"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Slider */}
                <div
                  className="splitter"
                  onMouseDown={e => { draggingRef.current = true; document.body.style.cursor = 'ew-resize'; updateSplit(e.nativeEvent); }}
                />
                <div
                  className="handle"
                  onMouseDown={e => { draggingRef.current = true; document.body.style.cursor = 'ew-resize'; updateSplit(e.nativeEvent); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M8 6 2 12l6 6M16 6l6 6-6 6"/>
                  </svg>
                </div>

                <div className="compare-label l mono">{leftLabel}</div>
                <div className="compare-label r mono">{rightLabel}</div>
              </>
            ) : (
              /* Single view — shows the active version (displayUrl) */
              <div className="pane before" style={{ clipPath: 'none' }}>
                <img
                  src={effectiveSingleUrl}
                  alt="Photo"
                  onLoad={() => setImgLoaded(true)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: imgFilter }}
                  onError={() => setSingleUrlFailed(true)}
                />
                {hasEnhanced && (
                  <div className="compare-label r mono" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={10} /> ENHANCED
                  </div>
                )}
              </div>
            )}

            {imgLoaded && (
              <div style={{
                position: 'absolute', bottom: 38, right: 10, fontFamily: 'JetBrains Mono',
                fontSize: 10, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.5)',
                padding: '2px 6px', borderRadius: 2, zIndex: 4,
              }}>
                {zoom}% · FIT
              </div>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="tool-group">
            {tools.map(t => (
              <button key={t.key} className={`icon-btn ${activeTool === t.key ? 'active' : ''}`} onClick={() => setActiveTool(t.key)} title={t.label}>
                {t.icon}
              </button>
            ))}
          </div>
          <div className="tool-group">
            <button className={`icon-btn ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')} title="Pan"><Hand size={14} /></button>
            <button className="icon-btn" onClick={() => setZoom(Math.max(25, zoom - 25))} title="Zoom out"><ZoomOut size={14} /></button>
            <span className="zoom-readout">{zoom}%</span>
            <button className="icon-btn" onClick={() => setZoom(Math.min(400, zoom + 25))} title="Zoom in"><ZoomIn size={14} /></button>
            <button className="icon-btn" onClick={() => setZoom(100)} title="Fit"><Maximize2 size={14} /></button>
          </div>
          <div className="tool-group">
            <button className="icon-btn"><Undo2 size={14} /></button>
            <button className="icon-btn"><Redo2 size={14} /></button>
            <button className="icon-btn"><Crop size={14} /></button>
          </div>
          <div className="tool-group">
            <button
              className={`icon-btn ${compareMode ? 'active' : ''}`}
              title={compareMode ? 'Hide compare' : 'Compare'}
              onClick={() => setCompareMode(m => !m)}
            >
              <Columns2 size={14} />
            </button>
          </div>

          {/* Inline adjustments */}
          <div className="tool-group" style={{ gap: 10, paddingLeft: 10 }}>
            {([
              { label: 'B', title: 'Brightness', value: brightness, set: setBrightness },
              { label: 'C', title: 'Contrast',   value: contrast,   set: setContrast   },
              { label: 'S', title: 'Saturation',  value: saturation, set: setSaturation },
            ] as const).map(adj => (
              <div key={adj.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  title={adj.title}
                  style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: adj.value !== 0 ? 'var(--accent)' : 'var(--ink-3)', minWidth: 10, textAlign: 'center' }}
                >
                  {adj.label}
                </span>
                <input
                  type="range"
                  min={-50} max={50} step={1}
                  value={adj.value}
                  title={`${adj.title}: ${adj.value > 0 ? '+' : ''}${adj.value}`}
                  onChange={e => adj.set(Number(e.target.value))}
                  style={{ width: 48, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>
            ))}
            {adjustmentsActive && (
              <button
                className="icon-btn"
                title="Reset adjustments"
                onClick={() => { setBrightness(0); setContrast(0); setSaturation(0); }}
                style={{ fontSize: 10, padding: '0 4px' }}
              >
                ↺
              </button>
            )}
          </div>

          <div className="grow-spacer" />
          <div className="tool-group" style={{ borderRight: 'none', paddingRight: 0, gap: 6 }}>
            <button
              className={`btn ${adjustmentsActive && isTauriRuntime() ? 'primary' : 'ghost'}`}
              disabled={!adjustmentsActive || !isTauriRuntime() || saving}
              onClick={() => void saveAdjustments()}
              style={{ minWidth: 108 }}
            >
              <Save size={12} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button className="btn primary"><Upload size={12} /> Export</button>
          </div>
        </div>
      </div>

      {/* Photo strip */}
      <div className="session-thumbs">
        {photos.map((p, i) => (
          <div
            key={p.id}
            onClick={event => {
              setActivePhoto(i + 1);
              if (event.shiftKey) selectPhotoRange(p.id);
              else if (event.metaKey || event.ctrlKey) togglePhotoSelection(p.id);
              else selectPhoto(p.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <SessionPhotoMini
              idx={i + 1}
              active={currentPhoto?.id === p.id}
              selected={selectedPhotoIds.includes(p.id)}
              status={p.processingStatus}
              src={p.thumbnailUrl}
              fallbackSrc={p.beforeImageUrl || p.displayUrl}
              filename={p.filename}
            />
          </div>
        ))}
        <div className="grow" />
      </div>

      {/* Session info */}
      <div className="row" style={{ padding: '8px 14px', borderTop: '1px solid var(--line)', background: 'var(--bg-1)', gap: 14 }}>
        <div className="row gap-2">
          <span className="uppercase">Active Session</span>
          <span className="mono pill accent">{session.sessionCode}</span>
        </div>
        <div className="row gap-2 mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          <span>{new Date(session.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
          <span style={{ color: 'var(--ink-5)' }}>·</span>
          <span>{session.photoCount} photos</span>
          <span style={{ color: 'var(--ink-5)' }}>·</span>
          <span>{session.captureLocationLabel.split('·')[0].trim()}</span>
        </div>
        <div className="grow" />
        <button
          className="btn ghost"
          disabled={selectedCount === 0}
          onClick={() => void (async () => {
            if (selectedCount === 0) return;
            const label = selectedCount === 1 ? 'this photo' : `${selectedCount} photos`;
            const confirmed = await confirmDestructive(
              'Imported files will also be removed from managed storage.',
              `Delete ${label} from this session?`,
            );
            if (confirmed) void deleteSelectedPhotos();
          })()}
        >
          <Trash2 size={12} /> Delete {selectedCount > 1 ? selectedCount : ''}
        </button>
      </div>
    </div>
  );
}
