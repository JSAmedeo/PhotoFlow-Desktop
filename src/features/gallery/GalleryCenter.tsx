import { useState } from 'react';
import { Search, ArrowUpDown, RefreshCw, Layers, Eye, Flag } from 'lucide-react';
import { Tile } from '../../components/Tile';
import { Seg } from '../../components/Seg';
import { useApp } from '../../context/AppContext';
import { HOUR_SHORT } from '../../data/models';
import type { FilterKey } from '../../data/models';

export function GalleryCenter() {
  const { sessions, allPhotos, selectedSessionId, selectedHour, selectSession, selectPhoto, setTab, filter, setFilter } = useApp();
  const [search, setSearch] = useState('');

  const short = HOUR_SHORT[selectedHour] ?? selectedHour;
  const totalImages = sessions.reduce((sum, s) => sum + s.photoCount, 0);

  const filtered = sessions.filter(s => {
    const matchSearch = s.sessionCode.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'All'       ? true :
      filter === 'Flagged'   ? s.status === 'flagged' :
      filter === 'Processed' ? s.status === 'complete' :
      filter === 'Pending'   ? s.status === 'active' : true;
    return matchSearch && matchFilter;
  });

  return (
    <div className="panel center" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Toolbar */}
      <div className="row" style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', gap: 10 }}>
        <div className="row gap-2">
          <span className="uppercase">Gallery</span>
          <span className="mono pill accent">{short}</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
            {sessions.length} sessions · {totalImages} images
          </span>
        </div>
        <div className="grow" />
        <div className="search-bar">
          <Search size={12} style={{ color: 'var(--ink-4)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search session ID..." />
        </div>
        <Seg
          value={filter}
          onChange={v => setFilter(v as FilterKey)}
          options={['All', 'Flagged', 'Processed', 'Pending']}
          style={{ minWidth: 200 }}
        />
        <button className="icon-btn"><ArrowUpDown size={13} /></button>
        <button className="icon-btn"><RefreshCw size={13} /></button>
      </div>

      {/* Session list */}
      <div className="panel-scroll grow" style={{ padding: '8px 0' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-4)' }}>
            No sessions match this filter.
          </div>
        )}
        {filtered.map(s => (
          <div
            key={s.id}
            style={{
              padding: '10px 14px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer',
              background: selectedSessionId === s.id ? 'rgba(61,214,196,0.04)' : 'transparent',
            }}
            onClick={() => selectSession(s.id)}
          >
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="row gap-2">
                <span className="mono" style={{
                  fontSize: 12, fontWeight: 600,
                  color: selectedSessionId === s.id ? 'var(--accent)' : 'var(--ink)',
                }}>
                  {s.sessionCode}
                </span>
                {s.status === 'flagged' && (
                  <span className="pill" style={{ color: 'var(--warn)', borderColor: 'rgba(232,176,74,0.4)', background: 'rgba(232,176,74,0.1)' }}>
                    <Flag size={10} /> Flagged
                  </span>
                )}
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>
                  {new Date(s.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>· {s.photoCount} images</span>
              </div>
              <div className="row gap-2">
                <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 10.5 }}>
                  <Eye size={11} /> Preview
                </button>
                <button
                  className="btn"
                  style={{ padding: '3px 8px', fontSize: 10.5 }}
                  onClick={e => { e.stopPropagation(); selectSession(s.id); setTab('workshop'); }}
                >
                  <Layers size={11} /> Open in Workshop
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allPhotos.filter(p => p.sessionId === s.id && !p.isHidden).map((photo, i) => (
                <div
                  key={photo.id}
                  onClick={e => { e.stopPropagation(); selectSession(s.id); selectPhoto(photo.id); }}
                  style={{
                  width: 84, height: 84, borderRadius: 3, overflow: 'hidden', position: 'relative', cursor: 'pointer',
                  border: `1px solid ${selectedSessionId === s.id && i === 0 ? 'var(--accent)' : 'var(--line)'}`,
                }}>
                  {photo.thumbnailUrl ? (
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.filename}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Tile tint={s.tint} size={84} sessionPos={s.id + i} />
                  )}
                  <div style={{
                    position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.65)',
                    color: '#fff', fontFamily: 'JetBrains Mono', fontSize: 9, padding: '1px 4px', borderRadius: 2,
                  }}>
                    {`#${String(i + 1).padStart(2, '0')}`}
                  </div>
                  {(photo.flag === 'flagged' || (s.status === 'flagged' && i === 0)) && (
                    <div style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
