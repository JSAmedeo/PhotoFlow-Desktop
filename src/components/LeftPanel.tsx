import { useEffect, useMemo, useState } from 'react';
import { MapPin, Calendar, ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CaptureLocation } from '../data/models';

const GLANCE_HOURS = Array.from({ length: 16 }, (_, index) => index + 7);

function shortHourLabel(hour: number): string {
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
}

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
  const { hours, selectedHour, setHour, locations, importQueue, selectedLocationId, setLocationId, operatingDate, setOperatingDate } = useApp();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(operatingDate.getFullYear(), operatingDate.getMonth(), 1));
  const activeHours = hours.filter(h => !h.isEmpty);
  const glanceHours = useMemo(() => {
    const byHour = new Map(hours.map(hour => [Number(hour.h.slice(0, 2)), hour]));
    return GLANCE_HOURS.map(hour => ({
      hour,
      bucket: byHour.get(hour),
    }));
  }, [hours]);
  const maxCount = Math.max(...glanceHours.map(({ bucket }) => bucket?.photoCount ?? 0), 1);
  const totalSessions = activeHours.reduce((s, h) => s + h.count, 0);
  const totalPhotos = activeHours.reduce((s, h) => s + h.photoCount, 0);
  const activeImports = importQueue.filter(item => item.status === 'queued' || item.status === 'stabilizing' || item.status === 'importing').length;
  const operatingDateLabel = operatingDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const todayMidnight = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
  const isToday = operatingDate.getTime() === todayMidnight.getTime();
  const monthLabel = calendarMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const canGoNextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1) <= todayMidnight;
  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  }, [calendarMonth]);

  useEffect(() => {
    setCalendarMonth(new Date(operatingDate.getFullYear(), operatingDate.getMonth(), 1));
  }, [operatingDate]);

  const stepDate = (direction: -1 | 1) => {
    const next = new Date(operatingDate);
    next.setDate(next.getDate() + direction);
    setOperatingDate(next);
  };

  const stepMonth = (direction: -1 | 1) => {
    setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const selectCalendarDate = (date: Date) => {
    if (date > todayMidnight) return;
    setOperatingDate(date);
    setCalendarOpen(false);
  };

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
        <div className="row gap-2" style={{ justifyContent: 'space-between', position: 'relative' }}>
          <button className="icon-btn" onClick={() => stepDate(-1)} title="Previous day"><ChevronLeft size={14} /></button>
          <button
            className="btn ghost"
            onClick={() => setCalendarOpen(open => !open)}
            style={{ flex: 1, justifyContent: 'center', minWidth: 0 }}
            title="Choose date"
          >
            <Calendar size={13} style={{ color: isToday ? 'var(--accent)' : 'var(--ink-3)' }} />
            <span style={{ fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{operatingDateLabel}</span>
          </button>
          <button className="icon-btn" onClick={() => stepDate(1)} disabled={isToday} style={isToday ? { opacity: 0.3, cursor: 'not-allowed' } : undefined} title="Next day"><ChevronRight size={14} /></button>
          {calendarOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 4,
              zIndex: 35, boxShadow: '0 10px 28px rgba(0,0,0,0.5)', padding: 8,
            }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <button className="icon-btn" onClick={() => stepMonth(-1)} title="Previous month"><ChevronLeft size={13} /></button>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600 }}>{monthLabel}</span>
                <button className="icon-btn" onClick={() => stepMonth(1)} disabled={!canGoNextMonth} style={!canGoNextMonth ? { opacity: 0.3, cursor: 'not-allowed' } : undefined} title="Next month"><ChevronRight size={13} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={`${day}-${i}`} className="mono" style={{ fontSize: 9, color: 'var(--ink-4)', textAlign: 'center' }}>{day}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {calendarDays.map(date => {
                  const time = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
                  const selected = time === operatingDate.getTime();
                  const future = time > todayMidnight.getTime();
                  const muted = date.getMonth() !== calendarMonth.getMonth();
                  return (
                    <button
                      key={date.toISOString()}
                      className={`icon-btn ${selected ? 'active' : ''}`}
                      disabled={future}
                      onClick={() => selectCalendarDate(date)}
                      style={{
                        width: '100%', height: 26, fontSize: 10,
                        color: selected ? 'var(--accent)' : muted ? 'var(--ink-5)' : 'var(--ink-2)',
                        opacity: future ? 0.3 : undefined,
                        cursor: future ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
              <span className={`badge-count ${selectedHour === h.h ? 'accent' : ''}`}>{h.count}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="panel-section" style={{ borderTop: '1px solid var(--line)', borderBottom: 'none', background: 'var(--bg-1)' }}>
        <div className="uppercase" style={{ marginBottom: 6 }}>Today at a glance</div>
        <div className="bars" style={{ height: 36, marginBottom: 4 }}>
          {glanceHours.map(({ hour, bucket }) => (
            <div
              key={hour}
              className={`b ${bucket?.h === selectedHour ? 'on' : ''}`}
              style={{ height: `${!bucket || bucket.photoCount === 0 ? 8 : Math.max(8, (bucket.photoCount / maxCount) * 100)}%`, flex: 1, opacity: !bucket || bucket.photoCount === 0 ? 0.28 : undefined }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
          {glanceHours.map(({ hour, bucket }) => (
            <div
              key={hour}
              className="mono"
              title={bucket?.label ?? `${hour}:00`}
              style={{
                flex: 1,
                minWidth: 0,
                color: bucket?.h === selectedHour ? 'var(--accent)' : 'var(--ink-5)',
                fontSize: 8,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'clip',
              }}
            >
              {shortHourLabel(hour)}
            </div>
          ))}
        </div>
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
