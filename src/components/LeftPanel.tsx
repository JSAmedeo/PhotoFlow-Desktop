import { useEffect, useState } from 'react';
import { MapPin, Calendar, ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CaptureLocation } from '../data/models';

function LocationSelect({ locations, selectedId, onSelect }: {
  locations: CaptureLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = locations.find(l => l.id === selectedId);

  return (
    <div style={{ position: 'relative' }}>
      <div className="select-ctrl" onClick={() => setOpen(o => !o)}>
        <div className="row gap-2">
          <MapPin size={13} style={{ color: selected ? 'var(--accent)' : 'var(--ink-4)' }} />
          <div className="col" style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{selected?.name ?? 'All Locations'}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
              {selected ? `${selected.code} · ${selected.isActive ? 'active' : 'paused'}` : 'Showing all streams'}
            </div>
          </div>
        </div>
        <div className="row gap-2">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: selected?.isActive ? 'var(--ok)' : 'var(--ink-5)', display: 'inline-block' }} />
          <ChevronDown size={13} />
        </div>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 3,
          zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div
            onClick={() => { onSelect(''); setOpen(false); }}
            style={{
              padding: '7px 9px', fontSize: 11.5,
              color: !selectedId ? 'var(--accent)' : 'var(--ink-2)',
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--line-soft)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-4)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span>All Locations</span>
            {!selectedId && <Check size={11} style={{ color: 'var(--accent)' }} />}
          </div>
          {locations.map(o => (
            <div
              key={o.id}
              onClick={() => { onSelect(o.id); setOpen(false); }}
              style={{
                padding: '7px 9px', fontSize: 11.5,
                color: o.id === selectedId ? 'var(--accent)' : 'var(--ink-2)',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-4)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{o.name}</span>
              <div className="row gap-2">
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{o.code}</span>
                {o.id === selectedId && <Check size={11} style={{ color: 'var(--accent)' }} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeftPanel() {
  const { hours, selectedHour, setHour, locations, importQueue, selectedLocationId, setLocationId } = useApp();
  const activeHours = hours.filter(h => !h.isEmpty);
  const maxCount = Math.max(...hours.map(h => h.photoCount), 1);
  const totalSessions = activeHours.reduce((s, h) => s + h.count, 0);
  const totalPhotos = activeHours.reduce((s, h) => s + h.photoCount, 0);
  const activeImports = importQueue.filter(item => item.status === 'queued' || item.status === 'stabilizing' || item.status === 'importing').length;
  const operatingDate = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  // Auto-select the most recent active hour when the current selection is empty or invalid.
  useEffect(() => {
    if (activeHours.length === 0) return;
    const isValid = activeHours.some(h => h.h === selectedHour);
    if (!isValid) setHour(activeHours[activeHours.length - 1].h);
  }, [activeHours, selectedHour, setHour]);

  return (
    <div className="panel left">
      <div className="panel-section">
        <div className="uppercase" style={{ marginBottom: 6 }}>Capture Location</div>
        <LocationSelect locations={locations} selectedId={selectedLocationId} onSelect={setLocationId} />
      </div>

      <div className="panel-section">
        <div className="uppercase" style={{ marginBottom: 6 }}>Operating Date</div>
        <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
          <button className="icon-btn"><ChevronLeft size={14} /></button>
          <div className="row gap-2">
            <Calendar size={13} style={{ color: 'var(--ink-3)' }} />
            <span style={{ fontWeight: 500, fontSize: 12 }}>{operatingDate}</span>
          </div>
          <button className="icon-btn"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="panel-section tight">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="uppercase">Hourly Folders</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{totalSessions} sessions · {totalPhotos} photos</div>
        </div>
      </div>

      <div className="panel-scroll grow">
        {activeHours.length === 0 && (
          <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 11, lineHeight: 1.4 }}>
            No photos imported today.
          </div>
        )}
        {activeHours.map(h => (
          <div
            key={h.h}
            className={`hour-row ${selectedHour === h.h ? 'selected' : ''}`}
            onClick={() => setHour(h.h)}
          >
            <div className="col">
              <div className="h-time">{h.label}</div>
              <div className="h-sub">{`${h.count} ${h.count === 1 ? 'session' : 'sessions'} · ${h.photoCount} ${h.photoCount === 1 ? 'photo' : 'photos'}`}</div>
            </div>
            <div className="row gap-2">
              <span className={`badge-count ${selectedHour === h.h ? 'accent' : ''}`}>{h.photoCount}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="panel-section" style={{ borderTop: '1px solid var(--line)', borderBottom: 'none', background: 'var(--bg-1)' }}>
        <div className="uppercase" style={{ marginBottom: 6 }}>Today at a glance</div>
        <div className="bars" style={{ height: 36, marginBottom: 4 }}>
          {hours.map((h, i) => (
            <div
              key={i}
              className={`b ${h.h === selectedHour ? 'on' : ''}`}
              style={{ height: `${h.photoCount === 0 ? 8 : Math.max(8, (h.photoCount / maxCount) * 100)}%`, flex: 1, opacity: h.photoCount === 0 ? 0.28 : undefined }}
            />
          ))}
        </div>
        {hours.length > 0 && (
          <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
            {hours.map(h => (
              <div
                key={h.h}
                className="mono"
                title={h.label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: h.h === selectedHour ? 'var(--accent)' : 'var(--ink-5)',
                  fontSize: 8,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'clip',
                }}
              >
                {Number(h.h.slice(0, 2))}
              </div>
            ))}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="col" style={{ lineHeight: 1.2 }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{totalSessions}</div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>SESSIONS</div>
          </div>
          <div className="col" style={{ lineHeight: 1.2 }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{totalPhotos}</div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>PHOTOS</div>
          </div>
          <div className="col" style={{ lineHeight: 1.2 }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{activeImports}</div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>IMPORTS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
