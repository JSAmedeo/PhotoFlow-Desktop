import { Search, Bell, Sun } from 'lucide-react';

export function TopBar() {
  return (
    <div className="topbar">
      <div className="row gap-2" style={{ minWidth: 240 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 4,
          background: 'linear-gradient(135deg, var(--accent), #1f6e64)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a1916" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
        </div>
        <div className="col" style={{ lineHeight: 1.05 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em' }}>
            PHOTOFLOW <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>DESKTOP</span>
          </div>
        </div>
      </div>

      <div className="grow" />

      <div className="grow" />

      <div className="row gap-2">
        <button className="icon-btn"><Search size={14} /></button>
        <button className="icon-btn" style={{ position: 'relative' }}>
          <Bell size={14} />
          <span style={{
            position: 'absolute', top: 5, right: 5, width: 6, height: 6,
            borderRadius: '50%', background: 'var(--warn)',
          }} />
        </button>
        <button className="icon-btn"><Sun size={14} /></button>
      </div>
    </div>
  );
}
