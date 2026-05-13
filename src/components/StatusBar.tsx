import { useApp } from '../context/AppContext';

export function StatusBar() {
  const { selectedSessionId, sessions, importQueue } = useApp();
  const session = sessions.find(s => s.id === selectedSessionId);
  const sessionCode = session?.sessionCode ?? '—';
  const totalSessions = sessions.length;
  const totalFlagged  = sessions.filter(s => s.status === 'flagged').length;
  const activeImports = importQueue.filter(item => item.status === 'queued' || item.status === 'importing').length;

  return (
    <div className="statusbar">
      <span className="row gap-2"><span className="dot" /> CONNECTED</span>
      <span className="sep" />
      <span>VENUE <span style={{ color: 'var(--ink)' }}>Giraffes</span></span>
      <span className="sep" />
      <span>SESSION <span style={{ color: 'var(--ink)' }}>{sessionCode}</span></span>
      <span className="sep" />
      <span>FRAME <span style={{ color: 'var(--ink)' }}>01/{String(session?.photoCount ?? 0).padStart(2, '0')}</span></span>
      <span className="sep" />
      <span>IMPORTS <span style={{ color: 'var(--accent)' }}>{activeImports}</span></span>
      <span className="sep" />
      <span>TODAY <span style={{ color: 'var(--ink)' }}>{totalSessions}</span> sessions · <span style={{ color: 'var(--warn)' }}>{totalFlagged}</span> flagged</span>
      <span className="spacer" />
      <span>GPU <span style={{ color: 'var(--ink)' }}>RTX 4080</span></span>
      <span className="sep" />
      <span>VRAM <span style={{ color: 'var(--ink)' }}>7.4 / 16 GB</span></span>
      <span className="sep" />
      <span>GALLERY API <span style={{ color: 'var(--ok)' }}>SYNC OK</span> · 42 ms</span>
      <span className="sep" />
      <span className="live">2:14:51 PM PDT</span>
    </div>
  );
}
