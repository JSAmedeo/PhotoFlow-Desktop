import { memo, useMemo, useState, useEffect, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Layers, Trash2, Check, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Tile } from '../../components/Tile';
import { useApp } from '../../context/AppContext';
import type { Photo, PhotoVersion, PhotoVersionKind } from '../../data/models';
import { confirmDestructive } from '../../utils/confirm';

const MAX_PREVIEW_THUMBS = 9;

function EnhanceBadge({ photo }: { photo: Photo }) {
  const status = photo.processingStatus;
  const isEnhanced = status === 'done' && photo.activeVersionKind === 'enhanced';
  const isProcessing = status === 'processing';
  const isError = status === 'error';

  if (!isEnhanced && !isProcessing && !isError) return null;

  return (
    <div style={{
      position: 'absolute', right: 3, bottom: 3,
      background: 'rgba(0,0,0,0.6)', borderRadius: 3,
      padding: '1px 3px', display: 'flex', alignItems: 'center',
    }}>
      {isProcessing && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />}
      {isEnhanced && <Sparkles size={10} style={{ color: 'var(--accent)' }} />}
      {isError && <AlertTriangle size={10} style={{ color: 'var(--warn)' }} />}
    </div>
  );
}

const PreviewThumb = memo(function PreviewThumb({
  photo,
  index,
  sessionTint,
  sessionId,
  active,
  selected,
  onClick,
}: {
  photo: Photo;
  index: number;
  sessionTint: [string, string];
  sessionId: string;
  active: boolean;
  selected: boolean;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 2, overflow: 'hidden',
        border: `1px solid ${active || selected ? 'var(--accent)' : 'var(--line)'}`,
        cursor: 'pointer',
        position: 'relative',
        flex: '0 0 auto',
      }}
    >
      {photo.thumbnailUrl ? (
        <img
          src={photo.thumbnailUrl}
          alt={photo.filename}
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <Tile tint={sessionTint} size={30} sessionPos={sessionId + index + 'r'} />
      )}
      {selected && (
        <div style={{ position: 'absolute', right: 2, bottom: 2, color: 'var(--accent)' }}>
          <Check size={9} strokeWidth={3} />
        </div>
      )}
      <EnhanceBadge photo={photo} />
    </div>
  );
});

function VersionSwitcher({
  photo,
  versions,
  onSwitch,
}: {
  photo: Photo;
  versions: PhotoVersion[];
  onSwitch: (kind: PhotoVersionKind) => void;
}) {
  if (versions.length === 0) return null;
  const active = photo.activeVersionKind ?? 'original';
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
      {(['original', 'enhanced'] as PhotoVersionKind[])
        .filter(kind => versions.some(v => v.kind === kind))
        .map(kind => (
          <button
            key={kind}
            className={`btn${active === kind ? ' primary' : ''}`}
            style={{ fontSize: 10, padding: '2px 8px', textTransform: 'capitalize' }}
            onClick={() => onSwitch(kind)}
          >
            {kind === 'enhanced' ? '✦ Enhanced' : 'Original'}
          </button>
        ))}
    </div>
  );
}

export function GalleryRight() {
  const {
    sessions, photos, selectedSessionId, selectedPhotoId, selectedPhotoIds,
    selectPhoto, togglePhotoSelection, selectPhotoRange, setTab, deleteSelectedPhotos, deleteSessionFromGallery,
    getPhotoVersions, switchPhotoVersion,
  } = useApp();
  const s = sessions.find(x => x.id === selectedSessionId) ?? sessions[0];
  const selectedPhoto = photos.find(p => p.id === selectedPhotoId) ?? photos[0];
  const selectedIndex = Math.max(0, photos.findIndex(p => p.id === selectedPhoto?.id));

  const [photoVersions, setPhotoVersions] = useState<PhotoVersion[]>([]);

  useEffect(() => {
    if (!selectedPhoto?.id) {
      setPhotoVersions([]);
      return;
    }
    void getPhotoVersions(selectedPhoto.id).then(setPhotoVersions);
  }, [selectedPhoto?.id, selectedPhoto?.processingStatus, getPhotoVersions]);

  const previewWindow = useMemo(() => {
    if (photos.length <= MAX_PREVIEW_THUMBS) return { start: 0, photos };
    const half = Math.floor(MAX_PREVIEW_THUMBS / 2);
    const start = Math.max(0, Math.min(selectedIndex - half, photos.length - MAX_PREVIEW_THUMBS));
    return {
      start,
      photos: photos.slice(start, start + MAX_PREVIEW_THUMBS),
    };
  }, [photos, selectedIndex]);
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

          {selectedPhoto && (
            <VersionSwitcher
              photo={selectedPhoto}
              versions={photoVersions}
              onSwitch={kind => void switchPhotoVersion(selectedPhoto.id, kind)}
            />
          )}

          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="icon-btn"><ChevronLeft size={13} /></button>
            <div className="grow" />
            <div style={{ display: 'flex', gap: 4, minWidth: 0, overflow: 'hidden' }}>
              {previewWindow.photos.map((photo, i) => {
                const absoluteIndex = previewWindow.start + i;
                return (
                  <PreviewThumb
                    key={photo.id}
                    photo={photo}
                    index={absoluteIndex}
                    sessionTint={s.tint}
                    sessionId={s.id}
                    active={photo.id === selectedPhoto?.id}
                    selected={selectedPhotoIds.includes(photo.id)}
                    onClick={event => {
                      if (event.shiftKey) selectPhotoRange(photo.id);
                      else if (event.ctrlKey || event.metaKey) togglePhotoSelection(photo.id);
                      else selectPhoto(photo.id);
                    }}
                  />
                );
              })}
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
              ['Location', s.captureLocationLabel.split('·')[0].trim()],
              ['Images',   `${s.photoCount} frames`],
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
            <button
              className="btn block"
              disabled={selectedPhotoIds.length === 0}
              onClick={() => void (async () => {
                if (selectedPhotoIds.length === 0) return;
                const label = selectedPhotoIds.length === 1 ? 'this photo' : `${selectedPhotoIds.length} photos`;
                const confirmed = await confirmDestructive(
                  'Imported files will also be removed from managed storage.',
                  `Delete ${label} from this session?`,
                );
                if (confirmed) void deleteSelectedPhotos();
              })()}
            >
              <Trash2 size={12} /> Delete selected
            </button>
            <button
              className="btn block"
              onClick={() => void (async () => {
                const label = `${s.sessionCode} (${s.photoCount} ${s.photoCount === 1 ? 'photo' : 'photos'})`;
                const confirmed = await confirmDestructive(
                  'Imported files in this session will also be removed from managed storage.',
                  `Delete session ${label} from PhotoFlow?`,
                );
                if (confirmed) void deleteSessionFromGallery(s.id);
              })()}
            >
              <Trash2 size={12} /> Delete session
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
