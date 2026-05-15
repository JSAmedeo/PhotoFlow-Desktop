import { useMemo, useState } from 'react';
import { Search, ArrowUpDown, RefreshCw, Layers, Eye, Flag, Trash2, Check } from 'lucide-react';
import { Tile } from '../../components/Tile';
import { Seg } from '../../components/Seg';
import { useApp } from '../../context/AppContext';
import type { FilterKey } from '../../data/models';

export function GalleryCenter() {
  const {
    sessions, allPhotos, selectedSessionId, selectedPhotoId, selectedPhotoIds, selectedHour,
    selectedLocationId, locations, hours, operatingDate,
    selectSession, selectPhoto, togglePhotoSelection, selectPhotoRange, deleteSelectedPhotos,
    deleteSessionFromGallery, setTab, filter, setFilter,
  } = useApp();
  const [search, setSearch] = useState('');

  const totalImages = sessions.reduce((sum, s) => sum + s.photoCount, 0);
  const activeLocation = selectedLocationId ? locations.find(l => l.id === selectedLocationId) : undefined;

  // Build the set of session IDs that have photos imported in the selected hour today.
  // When hours.length === 0 (no import activity yet — seed/demo mode), hour filtering is skipped.
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
    const matchLocation = !selectedLocationId || s.captureLocationId === selectedLocationId;
    const matchHour = !sessionIdsInSelectedHour || sessionIdsInSelectedHour.has(s.id);
    const matchSearch = s.sessionCode.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'All'       ? true :
      filter === 'Flagged'   ? s.status === 'flagged' :
      filter === 'Processed' ? s.status === 'complete' :
      filter === 'Pending'   ? s.status === 'active' : true;
    return matchLocation && matchHour && matchSearch && matchFilter;
  });

  return (
    <div className="panel center" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Toolbar */}
      <div className="row" style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', gap: 10 }}>
        <div className="row gap-2">
          <span className="uppercase">Gallery</span>
          {activeLocation && <span className="mono pill accent">{activeLocation.name}</span>}
          {sessionIdsInSelectedHour && (
            <span className="mono pill" style={{ color: 'var(--ink-3)', borderColor: 'var(--line)', background: 'transparent' }}>
              {selectedHour.slice(0, 2) === '00' ? '12 AM' :
               parseInt(selectedHour) < 12 ? `${parseInt(selectedHour)} AM` :
               parseInt(selectedHour) === 12 ? '12 PM' :
               `${parseInt(selectedHour) - 12} PM`}
            </span>
          )}
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
            {filtered.length}{sessions.length !== filtered.length ? `/${sessions.length}` : ''} sessions · {totalImages} images
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
        <button
          className="icon-btn"
          title="Delete selected photos"
          disabled={selectedPhotoIds.length === 0}
          onClick={() => {
            if (selectedPhotoIds.length === 0) return;
            const label = selectedPhotoIds.length === 1 ? 'this photo' : `${selectedPhotoIds.length} photos`;
            if (window.confirm(`Delete ${label} from PhotoFlow? Imported files will also be removed from managed storage.`)) {
              void deleteSelectedPhotos();
            }
          }}
        >
          <Trash2 size={13} />
        </button>
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
                <button
                  className="icon-btn"
                  title={`Delete session ${s.sessionCode}`}
                  onClick={e => {
                    e.stopPropagation();
                    const label = `${s.sessionCode} (${s.photoCount} ${s.photoCount === 1 ? 'photo' : 'photos'})`;
                    if (window.confirm(`Delete session ${label} from PhotoFlow? Imported files in this session will also be removed from managed storage.`)) {
                      void deleteSessionFromGallery(s.id);
                    }
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allPhotos.filter(p => p.sessionId === s.id && !p.isHidden).map((photo, i) => (
                <div
                  key={photo.id}
                  onClick={e => {
                    e.stopPropagation();
                    if (s.id !== selectedSessionId) {
                      selectSession(s.id, photo.id);
                      return;
                    }
                    if (e.shiftKey) selectPhotoRange(photo.id);
                    else if (e.ctrlKey || e.metaKey) togglePhotoSelection(photo.id);
                    else selectPhoto(photo.id);
                  }}
                  style={{
                  width: 84, height: 84, borderRadius: 3, overflow: 'hidden', position: 'relative', cursor: 'pointer',
                  border: `1px solid ${selectedPhotoIds.includes(photo.id) || selectedPhotoId === photo.id ? 'var(--accent)' : 'var(--line)'}`,
                  boxShadow: selectedPhotoIds.includes(photo.id) ? '0 0 0 2px rgba(61,214,196,0.35)' : undefined,
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
                  {selectedPhotoIds.includes(photo.id) && (
                    <div style={{
                      position: 'absolute', right: 4, bottom: 4, width: 16, height: 16, borderRadius: 3,
                      background: 'var(--accent)', color: '#04211f', display: 'grid', placeItems: 'center',
                    }}>
                      <Check size={11} strokeWidth={3} />
                    </div>
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
