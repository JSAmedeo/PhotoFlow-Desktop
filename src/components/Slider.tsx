import { useRef, useEffect } from 'react';

interface SliderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

export function Slider({ value, onChange, min = 0, max = 100 }: SliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = (e: MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onChange(Math.round(min + x * (max - min)));
  };

  useEffect(() => {
    const m = (e: MouseEvent) => { if (dragging.current) update(e); };
    const u = () => { dragging.current = false; };
    window.addEventListener('mousemove', m);
    window.addEventListener('mouseup', u);
    return () => { window.removeEventListener('mousemove', m); window.removeEventListener('mouseup', u); };
  });

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div
      className="slider"
      ref={ref}
      onMouseDown={(e) => { dragging.current = true; update(e.nativeEvent); }}
    >
      <div className="track" />
      <div className="fill" style={{ width: `${pct}%` }} />
      <div className="knob" style={{ left: `${pct}%` }} />
    </div>
  );
}
