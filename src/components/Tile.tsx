interface TileProps {
  tint: [string, string];
  size?: number;
  flagged?: boolean;
  sessionPos?: string | number;
}

export function Tile({ tint, size = 30, flagged = false, sessionPos = 0 }: TileProps) {
  const [a, b] = tint;
  const gradId = `tg-${String(a).replace('#','')}-${String(sessionPos)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="30" height="30" fill={`url(#${gradId})`} />
      <ellipse cx="11" cy="13" rx="3.5" ry="4" fill="rgba(0,0,0,0.18)" />
      <ellipse cx="18" cy="11" rx="3.8" ry="4.4" fill="rgba(0,0,0,0.22)" />
      <path d="M5 30 Q 15 18 25 30 Z" fill="rgba(0,0,0,0.25)" />
      {flagged && <circle cx="26" cy="4" r="2" fill="#e8b04a" />}
    </svg>
  );
}
