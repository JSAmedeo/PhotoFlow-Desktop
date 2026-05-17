import { useMemo, useState } from 'react';
import { ArrowUpDown, Filter, Grid3X3, Plus, RefreshCw, Search, Settings } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ImageStream } from '../../data/models';
import { StreamCard } from './StreamCard';
import { StreamSetupDialog } from './StreamSetupDialog';
import { statusColor } from './streamUiHelpers';

export function ImageStreamsCenter() {
  const { imageStreams, importQueue } = useApp();
  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [settingsStream, setSettingsStream] = useState<ImageStream | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  const filtered = imageStreams.filter(stream =>
    `${stream.name} ${stream.slug} ${stream.code ?? ''}`.toLowerCase().includes(query.toLowerCase())
  );
  const active = imageStreams.filter(stream => stream.enabled).length;
  const withFolders = imageStreams.filter(stream => Boolean(stream.watchPath)).length;
  const ingestedToday = useMemo(() => {
    const today = new Date();
    return importQueue.filter(item => {
      if (item.status !== 'complete' || !item.importedAt) return false;
      const imported = new Date(item.importedAt);
      return imported.getFullYear() === today.getFullYear() &&
        imported.getMonth() === today.getMonth() &&
        imported.getDate() === today.getDate();
    }).length;
  }, [importQueue]);

  return (
    <div className="panel center stream-page">
      <div className="stream-rail">
        <div className="panel-section">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="uppercase">Photo Ops</div>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{active} active · {imageStreams.length} total</span>
          </div>
        </div>
        <div className="panel-scroll grow">
          {imageStreams.length === 0 ? (
            <div style={{ padding: '20px 12px', color: 'var(--ink-4)', fontSize: 11, lineHeight: 1.4 }}>
              Add a photo op to create the first inbound stream.
            </div>
          ) : (
            imageStreams.map(stream => (
              <div key={stream.id} className="stream-rail-row">
                <span className="stream-dot" style={{ background: statusColor(stream.status, stream.enabled) }} />
                <div className="col grow" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stream.name}</span>
                  <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{stream.totalImported} files</span>
                </div>
                <button className="icon-btn" title={`Configure ${stream.name}`} onClick={() => setSettingsStream(stream)}>
                  <Settings size={12} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="panel-section stream-rail-footer">
          <button className="btn primary block" onClick={() => setIsAdding(true)}>
            <Plus size={13} /> Add New Photo Op
          </button>
          <div className="mono" style={{ color: 'var(--ink-4)', fontSize: 10, marginTop: 10, lineHeight: 1.35 }}>
            New ops appear instantly across local ingest.
          </div>
        </div>
      </div>

      <div className="stream-main">
        <div className="stream-header">
          <div className="col">
            <div className="row gap-2">
              <span className="uppercase">Image Streams</span>
              <span className="pill accent mono">{active} active</span>
            </div>
            <div className="mono" style={{ color: 'var(--ink-4)', fontSize: 10.5, marginTop: 4 }}>
              {imageStreams.length} streams · {withFolders} folders · {ingestedToday} imported today
            </div>
          </div>
          <div className="grow" />
          <button className="btn ghost"><Filter size={13} /> Filter</button>
          <button className="btn ghost"><ArrowUpDown size={13} /> Sort</button>
          <div className="vdivider" style={{ height: 22 }} />
          <button className="btn ghost"><Grid3X3 size={13} /> Grid</button>
          <div className="search-bar">
            <Search size={12} style={{ color: 'var(--ink-4)' }} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search streams..." />
          </div>
          <button className="btn ghost"><RefreshCw size={13} /> Refresh all</button>
        </div>

        {filtered.length === 0 ? (
          <div className="stream-empty" />
        ) : (
          <div className="stream-grid">
            {filtered.map(stream => (
              <StreamCard
                key={stream.id}
                stream={stream}
                isSelected={selectedStreamId === stream.id}
                onSelect={setSelectedStreamId}
              />
            ))}
          </div>
        )}
      </div>

      <StreamSetupDialog open={isAdding} onClose={() => setIsAdding(false)} />
      <StreamSetupDialog open={settingsStream != null} stream={settingsStream} onClose={() => setSettingsStream(null)} />
    </div>
  );
}
