import { ChevronLeft, ChevronRight, Layers, Star, Flag, Trash2, Check } from 'lucide-react';
import { Tile } from '../../components/Tile';
import { useApp } from '../../context/AppContext';

export function GalleryRight() {
  const {
    sessions, photos, selectedSessionId, selectedPhotoId, selectedPhotoIds,
    selectPhoto, togglePhotoSelection, selectPhotoRange, setTab, toggleFlag, deleteSelectedPhotos, deleteSessionFromGallery,
  } = useApp();
  const s = sessions.find(x => x.id === selectedSessionId) ?? sessions[0];
  const selectedPhoto = photos.find(p => p.id === selectedPhotoId) ?? photos[0];
  if (!s) return <div className="panel right" />;

  return (
    <div className="panel right">
      <div className="panel-scroll grow">

        {/* Preview */}
        <div className="panel-section">
          <div className="uppercase" style={{ marginBottom: 8 }}>Preview</div>
          <div style={{
            width: '100%', aspectRatio: '4 / 3', borderRadius: 3, overflow: 'hidden',
            border: '1px solid var(--line)', background: '#000', position: 'relative',
          }}>
            <img
              src={selectedPhoto?.displayUrl ?? '/demo-assets/before.jpg'}
              alt={selectedPhoto?.filename ?? 'Session preview'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div style={{
              position: 'absolute', bottom: 6, left: 6, right: 6, display: 'flex',
              justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontSize: 9.5, color: 'rgba(255,255,255,0.85)',
            }}>
              <span style={{ background: 'rgba(0,0,0,0.55)', padding: '2px 5px', borderRadius: 2 }}>{s.sessionCode}</span>
              <span style={{ background: 'rgba(0,0,0,0.55)', padding: '2px 5px', borderRadius: 2 }}>
                #{String(Math.max(1, photos.findIndex(p => p.id === selectedPhoto?.id) + 1)).padStart(2, '0')} / {String(photos.length || s.photoCount).padStart(2, '0')}
              </span>
            </div>
          </div>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="icon-btn"><ChevronLeft size={13} /></button>
            <div className="grow" />
            <div style={{ display: 'flex', gap: 4 }}>
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  onClick={event => {
                    if (event.shiftKey) selectPhotoRange(photo.id);
                    else if (event.ctrlKey || event.metaKey) togglePhotoSelection(photo.id);
                    else selectPhoto(photo.id);
                  }}
                  style={{
                  width: 30, height: 30, borderRadius: 2, overflow: 'hidden',
                  border: `1px solid ${photo.id === selectedPhoto?.id || selectedPhotoIds.includes(photo.id) ? 'var(--accent)' : 'var(--line)'}`,
                  cursor: 'pointer',
                  position: 'relative',
                }}>
                  {photo.thumbnailUrl ? (
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.filename}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Tile tint={s.tint} size={30} sessionPos={s.id + i + 'r'} />
                  )}
                  {selectedPhotoIds.includes(photo.id) && (
                    <div style={{ position: 'absolute', right: 2, bottom: 2, color: 'var(--accent)' }}>
                      <Check size={9} strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="grow" />
            <button className="icon-btn"><ChevronRight size={13} /></button>
          </div>
        </div>

        {/* Session info */}
        <div className="panel-section">
          <div className="uppercase" style={{ marginBottom: 8 }}>Session Info</div>
          <div className="col" style={{ gap: 5 }}>
            {([
              ['Session',  s.sessionCode],
              ['Captured', new Date(s.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })],
              ['Location', s.captureLocationLabel],
              ['Images',   `${s.photoCount} frames`],
              ['Handler',  s.handler],
              ['Status',   s.status === 'flagged' ? 'Flagged · review' : 'Processed'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="row" style={{ justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                <span className="mono" style={{ color: k === 'Status' && s.status === 'flagged' ? 'var(--warn)' : 'var(--ink)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Processing info */}
        <div className="panel-section">
          <div className="uppercase" style={{ marginBottom: 8 }}>Processing</div>
          <div className="col" style={{ gap: 5 }}>
            {([
              ['Background',  'Removed · Local'],
              ['Enhancement', 'Real-ESRGAN + GFPGAN'],
              ['Upscale',     '2× · 12000×8000'],
              ['Format',      'JPEG q92'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="row" style={{ justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                <span className="mono" style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="panel-section" style={{ borderBottom: 'none' }}>
          <div className="col" style={{ gap: 6 }}>
            <button className="btn primary block" onClick={() => setTab('workshop')}>
              <Layers size={13} /> Open in Workshop
            </button>
            <button className="btn block"><Star size={12} /> Favorite session</button>
            <button className="btn block" onClick={() => {
              const firstPhoto = selectedPhoto?.id ?? photos[0]?.id;
              if (firstPhoto) toggleFlag(firstPhoto);
            }}>
              <Flag size={12} /> {s.status === 'flagged' ? 'Unflag' : 'Flag for review'}
            </button>
            <button
              className="btn block"
              disabled={selectedPhotoIds.length === 0}
              onClick={() => {
                if (selectedPhotoIds.length === 0) return;
                const label = selectedPhotoIds.length === 1 ? 'this photo' : `${selectedPhotoIds.length} photos`;
                if (window.confirm(`Delete ${label} from this session? Imported files will also be removed from managed storage.`)) {
                  void deleteSelectedPhotos();
                }
              }}
            >
              <Trash2 size={12} /> Delete selected
            </button>
            <button
              className="btn block"
              onClick={() => {
                const label = `${s.sessionCode} (${s.photoCount} ${s.photoCount === 1 ? 'photo' : 'photos'})`;
                if (window.confirm(`Delete session ${label} from PhotoFlow? Imported files in this session will also be removed from managed storage.`)) {
                  void deleteSessionFromGallery(s.id);
                }
              }}
            >
              <Trash2 size={12} /> Delete session
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
