import { useMemo } from 'react';
import { Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tile } from '../../components/Tile';
import { useApp } from '../../context/AppContext';
import type { Photo } from '../../data/models';

export function HourFilmstrip() {
  const { sessions, allPhotos, selectedSessionId, selectSession, selectedHour, selectedLocationId, hours, operatingDate } = useApp();

  // Index allPhotos by sessionId once per allPhotos change — avoids O(sessions × photos) filter in the render loop.
  const photosBySession = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const photo of allPhotos) {
      if (photo.isHidden) continue;
      const list = map.get(photo.sessionId);
      if (list) list.push(photo);
      else map.set(photo.sessionId, [photo]);
    }
    return map;
  }, [allPhotos]);

  const sessionIdsInSelectedHour = useMemo(() => {
    if (hours.length === 0) return null;
    const hourNum = parseInt(selectedHour, 10);
    const startOfDay = operatingDate.getTime();
    const endOfDay = startOfDay + 86_400_000;
    const set = new Set<string>();
    for (const photo of allPhotos) {
      if (!photo.importedAt) continue;
      const t = new Date(photo.importedAt).getTime();
      if (isNaN(t) || t < startOfDay || t >= endOfDay) continue;
      if (new Date(t).getHours() === hourNum) set.add(photo.sessionId);
    }
    return set;
  }, [allPhotos, hours.length, selectedHour, operatingDate]);

  const filtered = sessions.filter(s => {
    const matchHour = !sessionIdsInSelectedHour || sessionIdsInSelectedHour.has(s.id);
    const matchLocation = !selectedLocationId || s.captureLocationId === selectedLocationId;
    return matchHour && matchLocation;
  });

  const hourLabel =
    selectedHour.slice(0, 2) === '00' ? '12 AM' :
    parseInt(selectedHour) < 12 ? `${parseInt(selectedHour)} AM` :
    parseInt(selectedHour) === 12 ? '12 PM' :
    `${parseInt(selectedHour) - 12} PM`;

  const totalImages = filtered.reduce((sum, s) => sum + s.photoCount, 0);

  return (
    <div style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div className="row" style={{ padding: '6px 14px', borderBottom: '1px solid var(--line-soft)', gap: 10 }}>
        <span className="uppercase">{sessionIdsInSelectedHour ? hourLabel : 'All'} Sessions</span>
        <span className="mono pill" style={{ fontSize: 10 }}>
          {filtered.length} sessions · {totalImages} images
        </span>
        <div className="grow" />
        <div className="row gap-2">
          <button className="icon-btn"><Filter size={13} /></button>
          <button className="icon-btn"><ArrowUpDown size={13} /></button>
          <span className="vdivider" style={{ height: 14, margin: '0 2px' }} />
          <button className="icon-btn"><ChevronLeft size={14} /></button>
          <button className="icon-btn"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', overflowX: 'auto', padding: '10px 14px', gap: 0, alignItems: 'stretch' }}>
        {filtered.map((s, si) => {
          const sessionPhotos = photosBySession.get(s.id) ?? [];
          const previewPhotos = sessionPhotos.slice(0, 2);
          const remaining = sessionPhotos.length - previewPhotos.length;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'stretch' }}>
              {si > 0 && <div style={{ width: 1, background: 'var(--line)', margin: '0 10px', flexShrink: 0 }} />}
              <div
                onClick={() => selectSession(s.id)}
                style={{
                  cursor: 'pointer', padding: '5px 7px 6px', borderRadius: 3, flexShrink: 0,
                  background: selectedSessionId === s.id ? 'rgba(61,214,196,0.08)' : 'transparent',
                  border: selectedSessionId === s.id ? '1px solid var(--accent-line)' : '1px solid transparent',
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
                  <span className="sg-code" style={{ color: selectedSessionId === s.id ? 'var(--accent)' : 'var(--ink-2)' }}>
                    {s.sessionCode}
                  </span>
                  <span className="sg-time">
                    {new Date(s.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  {previewPhotos.map((photo, i) => (
                    <div key={photo.id} className={`thumb-sq ${photo.flag === 'flagged' || (s.status === 'flagged' && i === 0) ? 'flagged' : ''}`} style={{ width: 36, height: 36 }}>
                      {photo.thumbnailUrl ? (
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.filename}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <Tile tint={s.tint} size={36} sessionPos={s.id + i} />
                      )}
                    </div>
                  ))}
                  {remaining > 0 && (
                    <div style={{
                      width: 36, height: 36, borderRadius: 2, background: 'var(--bg-3)',
                      border: '1px solid var(--line)', display: 'grid', placeItems: 'center', flexShrink: 0,
                    }}>
                      <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>+{remaining}</span>
                    </div>
                  )}
                  {previewPhotos.length === 0 && (
                    <Tile tint={s.tint} size={36} sessionPos={s.id} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
