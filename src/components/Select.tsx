import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}

export function Select({ value, onChange, options }: SelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <div className="select-ctrl" onClick={() => setOpen(o => !o)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        <ChevronDown size={14} />
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 3,
          zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {options.map(o => (
            <div
              key={o}
              onClick={() => { onChange(o); setOpen(false); }}
              style={{
                padding: '7px 9px', fontSize: 11.5,
                color: o === value ? 'var(--accent)' : 'var(--ink-2)', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-4)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
