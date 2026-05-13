import { Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tile } from '../../components/Tile';
import { useApp } from '../../context/AppContext';
import { HOUR_SHORT } from '../../data/models';

export function HourFilmstrip() {
  const { sessions, allPhotos, selectedSessionId, selectSession, selectedHour } = useApp();
  const short = HOUR_SHORT[selectedHour] ?? selectedHour;
  const totalImages = sessions.reduce((sum, s) => sum + s.photoCount, 0);

  return (
    <div style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div className="row" style={{ padding: '6px 14px', borderBottom: '1px solid var(--line-soft)', gap: 10 }}>
        <span className="uppercase">{short} Sessions</span>
        <span className="mono pill" style={{ fontSize: 10 }}>
          {sessions.length} sessions · {totalImages} images
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
        {sessions.map((s, si) => (
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
              <div style={{ display: 'flex', gap: 3 }}>
                {allPhotos.filter(p => p.sessionId === s.id && !p.isHidden).map((photo, i) => (
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
