import { useRef, useEffect, useState, memo, useCallback } from 'react';
import { Maximize2, Paintbrush, Eraser, Wand2, Hand, ZoomOut, ZoomIn, Undo2, Redo2, Crop, Upload, Check, Trash2 } from 'lucide-react';
import { HourFilmstrip } from './HourFilmstrip';
import { useApp } from '../../context/AppContext';
import { confirmDestructive } from '../../utils/confirm';

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
  idx, active, selected, status, src, filename,
}: { idx: number; active: boolean; selected: boolean; status: string; src: string; filename: string }) {
  return (
    <div className={`session-thumb ${active ? 'active' : ''}`} style={{ boxShadow: selected ? '0 0 0 2px rgba(61,214,196,0.55)' : undefined }}>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <img
          src={src}
          alt={filename || `Frame ${idx}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
  } = useApp();
  const session = sessions.find(s => s.id === selectedSessionId) ?? sessions[0];
  const selectedIndex = Math.max(0, photos.findIndex(p => p.id === selectedPhotoId));
  const currentIndex = photos[activePhoto - 1] ? activePhoto - 1 : selectedIndex;
  const currentPhoto = photos[currentIndex] ?? photos[0];
  const selectedCount = selectedPhotoIds.length;
  const wrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const updateSplit = useCallback((e: MouseEvent) => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setSplit(Math.max(2, Math.min(98, ((e.clientX - r.left) / r.width) * 100)));
  }, [setSplit]); // setSplit is a useState setter — stable across renders

  useEffect(() => {
    const m = (e: MouseEvent) => { if (draggingRef.current) updateSplit(e); };
    const u = () => { draggingRef.current = false; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', m);
    window.addEventListener('mouseup', u);
    return () => { window.removeEventListener('mousemove', m); window.removeEventListener('mouseup', u); };
  }, [updateSplit]); // updateSplit is stable via useCallback — attaches once

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
            style={{ width: '100%', height: '100%', maxWidth: 1080, maxHeight: 620, aspectRatio: '1080 / 620', '--split': `${split}%` } as React.CSSProperties}
          >
            <div className="pane before">
              <img src={currentPhoto?.beforeImageUrl ?? '/demo-assets/before.jpg'} alt="Before" onLoad={() => setImgLoaded(true)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className="pane after">
              <div className="checker" style={{ position: 'absolute', inset: 0 }} />
              <img src={currentPhoto?.afterImageUrl ?? currentPhoto?.beforeImageUrl ?? '/demo-assets/after.png'} alt="After"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className="splitter" onMouseDown={e => { draggingRef.current = true; document.body.style.cursor = 'ew-resize'; updateSplit(e.nativeEvent); }} />
            <div className="handle"   onMouseDown={e => { draggingRef.current = true; document.body.style.cursor = 'ew-resize'; updateSplit(e.nativeEvent); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M8 6 2 12l6 6M16 6l6 6-6 6"/>
              </svg>
            </div>
            <div className="compare-label l mono">BEFORE — ORIGINAL</div>
            <div className="compare-label r mono">AFTER — PROCESSED · v2.4</div>
            {imgLoaded && (
              <div style={{ position: 'absolute', bottom: 38, right: 10, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 2, zIndex: 4 }}>
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
          <div className="grow-spacer" />
          <div className="tool-group" style={{ borderRight: 'none', paddingRight: 0 }}>
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
