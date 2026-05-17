import { FileImage, Trash2 } from 'lucide-react';
import type { FolderFileEntry } from './streamUiHelpers';
import { fmtTime } from './streamUiHelpers';

export function StreamFolderTab({
  folderFiles,
  watchPath,
  isDesktop,
  deletingFile,
  onDelete,
}: {
  folderFiles: FolderFileEntry[];
  watchPath: string | null;
  isDesktop: boolean;
  deletingFile: string | null;
  onDelete: (filename: string) => void;
}) {
  if (!isDesktop || !watchPath) {
    return (
      <div className="mono" style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 10.5 }}>
        — desktop only —
      </div>
    );
  }

  if (folderFiles.length === 0) {
    return (
      <div className="mono" style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 10.5 }}>
        — folder empty —
      </div>
    );
  }

  return (
    <>
      {folderFiles.slice(0, 8).map(file => (
        <div key={file.name} className="stream-file-row" onClick={e => e.stopPropagation()}>
          <span className="mono stream-file-name">
            <FileImage size={10} style={{ color: 'var(--ink-4)', verticalAlign: -1, marginRight: 4, flexShrink: 0 }} />
            {file.name}
          </span>
          <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10, textAlign: 'right' }}>
            {file.modified_ms != null ? fmtTime(new Date(file.modified_ms).toISOString()) : '—'}
          </span>
          <span className="mono" style={{ color: 'var(--ink-5)', fontSize: 10, textAlign: 'right' }}>
            {`${(file.size / (1024 * 1024)).toFixed(1)} MB`}
          </span>
          <button
            title="Delete file"
            disabled={deletingFile === file.name}
            onClick={e => { e.stopPropagation(); onDelete(file.name); }}
            style={{
              background: 'none', border: 'none', cursor: deletingFile === file.name ? 'wait' : 'pointer',
              padding: '0 2px', color: 'var(--ink-4)', display: 'flex', alignItems: 'center', flexShrink: 0,
              opacity: deletingFile === file.name ? 0.4 : 1,
            }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
    </>
  );
}
