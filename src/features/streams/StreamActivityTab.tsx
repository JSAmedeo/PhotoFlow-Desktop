import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import type { ImportQueueItem } from '../../data/models';

function queueStatusIcon(status: ImportQueueItem['status']) {
  if (status === 'complete') return <CheckCircle size={11} />;
  if (status === 'skipped' || status === 'failed') return <AlertCircle size={11} />;
  return <RefreshCw size={10} />;
}

function queueStatusColor(status: ImportQueueItem['status']): string {
  if (status === 'complete') return 'var(--ok)';
  if (status === 'failed') return 'var(--warn)';
  if (status === 'skipped') return '#e8b04a';
  return 'var(--ink-4)';
}

export function StreamActivityTab({
  streamQueue,
}: {
  streamQueue: ImportQueueItem[];
  issueCount: number;
}) {
  if (streamQueue.length === 0) {
    return (
      <div className="mono" style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 10.5 }}>
        — no activity yet —
      </div>
    );
  }

  return (
    <>
      {streamQueue.map(item => {
        const color = queueStatusColor(item.status);
        const isIssue = item.status === 'skipped' || item.status === 'failed';
        return (
          <div
            key={item.id}
            style={{
              padding: '5px 10px',
              borderBottom: '1px solid var(--line-soft)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              background: isIssue ? 'rgba(232,176,74,0.04)' : 'transparent',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              <span style={{ color, flexShrink: 0 }}>{queueStatusIcon(item.status)}</span>
              <span className="mono" style={{
                fontSize: 10.5,
                color: 'var(--ink-2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}>
                {item.filename}
              </span>
              <span className="mono" style={{ fontSize: 9.5, color, flexShrink: 0 }}>
                {item.status === 'complete' ? 'OK' : item.status === 'skipped' ? 'SKIPPED' : item.status === 'failed' ? 'FAIL' : item.status.toUpperCase()}
              </span>
            </div>
            {isIssue && item.error && (
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-4)', paddingLeft: 17, lineHeight: 1.3 }}>
                {item.error}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
