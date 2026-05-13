interface SegProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  style?: React.CSSProperties;
}

export function Seg({ value, onChange, options, style }: SegProps) {
  return (
    <div className="seg" style={style}>
      {options.map(o => (
        <button key={o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
