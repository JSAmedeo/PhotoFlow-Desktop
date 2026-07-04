import { useEffect, useMemo, useState } from 'react';
import { Folder, FolderOpen, MapPin, Printer, Settings } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ImageStream, ImportQueueItem } from '../../data/models';
import { isTauriRuntime } from '../../runtime/runtime';
import { grantWatchPathAccess } from '../../ingest/watchedFolderService';
import { AutoPrintSetupDialog } from './AutoPrintSetupDialog';
import { StreamActivityTab } from './StreamActivityTab';
import { StreamFolderTab } from './StreamFolderTab';
import { computeSparkline, statusColor, statusLabel } from './streamUiHelpers';
import type { FolderFileEntry } from './streamUiHelpers';

async function openInExplorer(path: string): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    await invoke('reveal_in_explorer', { path });
  } catch (error) {
    console.warn('[PhotoFlow] Could not reveal path in explorer:', error);
  }
}

function Sparkline({ data, width = 92, height = 22 }: { data: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...data);
  const step = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(height - (v / max) * (height - 2) - 1).toFixed(1)}`).join(' ');
  const area = `${pts} L ${width} ${height} L 0 ${height} Z`;
  const lastX = ((data.length - 1) * step).toFixed(1);
  const lastY = (height - (data[data.length - 1] / max) * (height - 2) - 1).toFixed(1);
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={area} fill="var(--accent)" fillOpacity="0.12" />
      <path d={pts} fill="none" stroke="var(--accent)" strokeWidth="1.2" />
      <circle cx={lastX} cy={lastY} r="2" fill="var(--accent)" />
    </svg>
  );
}

export function Toggle({ on, onChange, size = 'md' }: { on: boolean; onChange: () => void; size?: 'sm' | 'md' }) {
  return (
    <button
      className={`stream-toggle${size === 'sm' ? ' stream-toggle-sm' : ''}`}
      type="button"
      aria-pressed={on}
      onClick={onChange}
      title={on ? 'Disable' : 'Enable'}
    >
      <span />
    </button>
  );
}

export function StreamCard({ stream, isSelected, onSelect }: { stream: ImageStream; isSelected: boolean; onSelect: (id: string) => void }) {
  const { updateImageStream, importQueue } = useApp();
  const [autoPrintOpen, setAutoPrintOpen] = useState(false);
  const [cardView, setCardView] = useState<'folder' | 'activity'>('folder');
  const [folderFiles, setFolderFiles] = useState<FolderFileEntry[]>([]);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const isDesktop = isTauriRuntime();
  const sparkData = useMemo(() => computeSparkline(stream.id, importQueue), [stream.id, importQueue]);

  const streamQueue = useMemo((): ImportQueueItem[] =>
    importQueue
      .filter(item => item.imageStreamId === stream.id)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 12),
    [importQueue, stream.id],
  );

  const issueCount = useMemo(
    () => streamQueue.filter(item => item.status === 'skipped' || item.status === 'failed').length,
    [streamQueue],
  );

  const refreshFolder = async () => {
    if (!stream.watchPath) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<FolderFileEntry[]>('list_folder_files', { path: stream.watchPath });
      setFolderFiles(files);
    } catch {
      setFolderFiles([]);
    }
  };

  const deleteWatchedFile = async (filename: string) => {
    if (!stream.watchPath) return;
    setDeletingFile(filename);
    try {
      const { join } = await import('@tauri-apps/api/path');
      const { remove } = await import('@tauri-apps/plugin-fs');
      // The fs scope no longer allows `**`; ensure this watch folder is granted before
      // removing a file directly (the watcher may not be running for a disabled stream).
      await grantWatchPathAccess(stream.watchPath);
      await remove(await join(stream.watchPath, filename));
      await refreshFolder();
    } catch (err) {
      console.warn('[PhotoFlow] Could not delete watched file:', err);
    } finally {
      setDeletingFile(null);
    }
  };

  useEffect(() => {
    if (!isDesktop || !stream.watchPath) {
      setFolderFiles([]);
      return;
    }
    void refreshFolder();
    const interval = setInterval(() => void refreshFolder(), 2000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, stream.watchPath]);

  const color = statusColor(stream.status, stream.enabled);

  return (
    <div
      className={`stream-card${isSelected ? ' stream-card-selected' : ''}${!stream.enabled ? ' stream-card-inactive' : ''}`}
      onClick={() => onSelect(stream.id)}
    >
      {stream.enabled && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.55 }} />
      )}

      {/* Header */}
      <div className="row" style={{ gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="stream-icon" style={{ color, background: stream.enabled ? 'rgba(61,214,196,0.10)' : 'var(--bg-3)' }}>
          <MapPin size={14} />
        </div>
        <div className="col grow" style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div className="row gap-2" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stream.name}</span>
          </div>
          <div className="row gap-1 mono" style={{ fontSize: 9.5, marginTop: 2, letterSpacing: '0.04em' }}>
            <span className="stream-dot" style={{
              background: color,
              boxShadow: stream.enabled ? `0 0 0 2px ${stream.status === 'error' || stream.status === 'review' ? 'rgba(232,176,74,0.18)' : 'rgba(98,200,122,0.18)'}` : 'none',
              animation: stream.enabled ? 'streamPulse 1.8s ease-in-out infinite' : 'none',
            }} />
            <span style={{ color }}>{statusLabel(stream.status, stream.enabled).toUpperCase()}</span>
            {stream.enabled && stream.filesPerMinute != null && (
              <><span style={{ color: 'var(--ink-5)' }}>·</span><span style={{ color: 'var(--ink-3)' }}>{stream.filesPerMinute}/min</span></>
            )}
          </div>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <Toggle on={stream.enabled} onChange={() => void updateImageStream(stream.id, { enabled: !stream.enabled })} />
        </div>
      </div>

      {/* Folder path */}
      <div className="row" style={{ padding: '7px 12px', gap: 8, borderBottom: '1px solid var(--line-soft)', background: 'var(--bg)' }}>
        <Folder size={12} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
        <span
          className="mono grow"
          title={stream.watchPath ?? undefined}
          style={{ color: stream.watchPath ? 'var(--ink-3)' : 'var(--ink-4)', fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}
        >
          {stream.watchPath ?? 'No folder selected'}
        </span>
        {stream.watchPath && isDesktop && (
          <button
            className="icon-btn"
            style={{ width: 22, height: 22, flexShrink: 0 }}
            title="Open folder in Explorer"
            onClick={e => { e.stopPropagation(); void openInExplorer(stream.watchPath!); }}
          >
            <FolderOpen size={12} />
          </button>
        )}
      </div>

      {/* Counters + sparkline */}
      <div className="row" style={{ padding: '9px 12px', gap: 10, borderBottom: '1px solid var(--line-soft)' }}>
        <div className="col" style={{ flex: 1, gap: 2 }}>
          <div className="row" style={{ gap: 14 }}>
            <div className="col" style={{ lineHeight: 1.05 }}>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{stream.totalDetected}</span>
              <span className="mono" style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--ink-4)' }}>IN</span>
            </div>
            <div className="col" style={{ lineHeight: 1.05 }}>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ok)' }}>{stream.totalImported}</span>
              <span className="mono" style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--ink-4)' }}>OK</span>
            </div>
            <div
              className="col"
              style={{ lineHeight: 1.05, cursor: stream.totalFailed ? 'pointer' : 'default' }}
              title={stream.totalFailed ? 'Click to reset error count' : undefined}
              onClick={stream.totalFailed ? e => { e.stopPropagation(); void updateImageStream(stream.id, { totalFailed: 0 }); } : undefined}
            >
              <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: stream.totalFailed ? 'var(--warn)' : 'var(--ink-4)' }}>{stream.totalFailed}</span>
              <span className="mono" style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--ink-4)' }}>ERR</span>
            </div>
          </div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
          <Sparkline data={sparkData} width={92} height={22} />
          <span className="mono" style={{ fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>FILES / MIN · 30m</span>
        </div>
      </div>

      {/* Folder / Activity tabbed view */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#0a0b0d' }}>

        {/* Tab header */}
        <div className="row" style={{ borderBottom: '1px solid var(--line-soft)', gap: 0 }} onClick={e => e.stopPropagation()}>
          {(['folder', 'activity'] as const).map(tab => {
            const isActive = cardView === tab;
            const label = tab === 'folder' ? 'FOLDER' : 'ACTIVITY';
            return (
              <button
                key={tab}
                className="mono"
                style={{
                  padding: '6px 10px',
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                  marginBottom: -1,
                  color: isActive ? 'var(--accent)' : 'var(--ink-4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                onClick={() => setCardView(tab)}
              >
                {label}
                {tab === 'activity' && issueCount > 0 && (
                  <span style={{
                    background: 'var(--warn)',
                    color: '#0a0b0d',
                    borderRadius: 3,
                    fontSize: 8.5,
                    fontWeight: 700,
                    padding: '0 3px',
                    lineHeight: '13px',
                    minWidth: 13,
                    textAlign: 'center',
                  }}>
                    {issueCount}
                  </span>
                )}
              </button>
            );
          })}
          <span className="grow" />
          {cardView === 'folder' && (
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-5)', padding: '6px 10px' }}>NAME · MODIFIED · SIZE</span>
          )}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {cardView === 'folder' ? (
            <StreamFolderTab
              folderFiles={folderFiles}
              watchPath={stream.watchPath ?? null}
              isDesktop={isDesktop}
              deletingFile={deletingFile}
              onDelete={filename => void deleteWatchedFile(filename)}
            />
          ) : (
            <StreamActivityTab streamQueue={streamQueue} issueCount={issueCount} />
          )}
        </div>
      </div>

      {/* Auto-print footer */}
      <div className="autoprint-strip" onClick={e => e.stopPropagation()}>
        <Printer size={13} style={{ color: stream.autoPrintEnabled ? 'var(--accent)' : 'var(--ink-4)', flexShrink: 0 }} />
        <div className="col grow" style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div className="row gap-2">
            <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>Auto-print</span>
            <span className="mono" style={{ fontSize: 9.5, color: stream.autoPrintEnabled ? 'var(--accent)' : 'var(--ink-4)', letterSpacing: '0.08em' }}>{stream.autoPrintEnabled ? 'ON' : 'OFF'}</span>
          </div>
          <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 9.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stream.printerName ?? 'Epson SureColor P900'} · <span style={{ color: stream.autoPrintEnabled ? 'var(--ok)' : 'var(--ink-3)' }}>{stream.autoPrintEnabled ? 'ready' : 'idle'}</span>
          </span>
        </div>
        <button className="icon-btn" style={{ width: 24, height: 24 }} title="Auto-print settings" onClick={() => setAutoPrintOpen(true)}>
          <Settings size={13} />
        </button>
        <Toggle on={stream.autoPrintEnabled ?? false} onChange={() => void updateImageStream(stream.id, { autoPrintEnabled: !(stream.autoPrintEnabled ?? false) })} size="sm" />
      </div>
      {autoPrintOpen && <AutoPrintSetupDialog stream={stream} onClose={() => setAutoPrintOpen(false)} />}
    </div>
  );
}
