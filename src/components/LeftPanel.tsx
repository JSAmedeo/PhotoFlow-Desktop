import { useState } from 'react';
import { MapPin, Calendar, ChevronLeft, ChevronRight, ChevronDown, Flag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CaptureLocation } from '../data/models';

function LocationSelect({ locations }: { locations: CaptureLocation[] }) {
  const [loc, setLoc] = useState<CaptureLocation>(locations[1] ?? locations[0]);
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <div className="select-ctrl" onClick={() => setOpen(o => !o)}>
        <div className="row gap-2">
          <MapPin size={13} style={{ color: 'var(--accent)' }} />
          <div className="col" style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{loc.name}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{loc.code} · Encounter</div>
          </div>
        </div>
        <div className="row gap-2">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
          <ChevronDown size={13} />
        </div>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 3,
          zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {locations.map(o => (
            <div
              key={o.id}
              onClick={() => { setLoc(o); setOpen(false); }}
              style={{
                padding: '7px 9px', fontSize: 11.5,
                color: o.id === loc.id ? 'var(--accent)' : 'var(--ink-2)',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-4)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{o.name}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{o.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeftPanel() {
  const { hours, selectedHour, setHour, locations, importQueue } = useApp();
  const maxCount = Math.max(...hours.map(h => h.count), 1);
  const totalSessions = hours.reduce((s, h) => s + h.count, 0);
  const totalFlagged  = hours.reduce((s, h) => s + h.flagged, 0);
  const activeImports = importQueue.filter(item => item.status === 'queued' || item.status === 'importing').length;

  return (
    <div className="panel left">
      <div className="panel-section">
        <div className="uppercase" style={{ marginBottom: 6 }}>Capture Location</div>
        <LocationSelect locations={locations} />
      </div>

      <div className="panel-section">
        <div className="uppercase" style={{ marginBottom: 6 }}>Operating Date</div>
        <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
          <button className="icon-btn"><ChevronLeft size={14} /></button>
          <div className="row gap-2">
            <Calendar size={13} style={{ color: 'var(--ink-3)' }} />
            <span style={{ fontWeight: 500, fontSize: 12 }}>Tue, May 13, 2026</span>
          </div>
          <button className="icon-btn"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="panel-section tight">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="uppercase">Hourly Folders</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{totalSessions} sessions</div>
        </div>
      </div>

      <div className="panel-scroll grow">
        {hours.map(h => (
          <div
            key={h.h}
            className={`hour-row ${selectedHour === h.h ? 'selected' : ''} ${h.count === 0 ? 'empty' : ''}`}
            onClick={() => setHour(h.h)}
          >
            <div className="col">
              <div className="h-time">{h.label}</div>
              <div className="h-sub">{h.sub}</div>
            </div>
            <div className="row gap-2">
              {h.flagged > 0 && <Flag size={11} style={{ color: 'var(--warn)' }} />}
              <span className={`badge-count ${selectedHour === h.h ? 'accent' : ''}`}>{h.count}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="panel-section" style={{ borderTop: '1px solid var(--line)', borderBottom: 'none', background: 'var(--bg-1)' }}>
        <div className="uppercase" style={{ marginBottom: 6 }}>Today at a glance</div>
        <div className="bars" style={{ height: 36, marginBottom: 8 }}>
          {hours.map((h, i) => (
            <div
              key={i}
              className={`b ${h.h === selectedHour ? 'on' : ''}`}
              style={{ height: `${Math.max(8, (h.count / maxCount) * 100)}%`, flex: 1 }}
            />
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="col" style={{ lineHeight: 1.2 }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{totalSessions}</div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>SESSIONS</div>
          </div>
          <div className="col" style={{ lineHeight: 1.2 }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--warn)' }}>{totalFlagged}</div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>FLAGGED</div>
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
