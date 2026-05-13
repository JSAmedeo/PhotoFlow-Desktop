// Lucide-style inline icons. All 16px default.
const Icon = ({ d, size=16, stroke=1.6, fill="none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {typeof d === 'string' ? <path d={d}/> : d}
  </svg>
);

const I = {
  Camera: (p)=> <Icon {...p} d={<><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2z"/><circle cx="12" cy="13" r="3.5"/></>}/>,
  ChevDown: (p)=> <Icon {...p} d="M6 9l6 6 6-6"/>,
  ChevLeft: (p)=> <Icon {...p} d="M15 18l-6-6 6-6"/>,
  ChevRight: (p)=> <Icon {...p} d="M9 18l6-6-6-6"/>,
  MapPin:   (p)=> <Icon {...p} d={<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>}/>,
  Cal:      (p)=> <Icon {...p} d={<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></>}/>,
  Search:   (p)=> <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>}/>,
  Filter:   (p)=> <Icon {...p} d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/>,
  Sort:     (p)=> <Icon {...p} d="M3 6h13M3 12h9M3 18h5M17 8V20m0 0l-3-3m3 3l3-3"/>,
  Refresh:  (p)=> <Icon {...p} d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16m0 5v-5h5"/>,
  Star:     (p)=> <Icon {...p} d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z"/>,
  Flag:     (p)=> <Icon {...p} d="M4 22V4m0 0h13l-2 4 2 4H4"/>,
  Layers:   (p)=> <Icon {...p} d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>,
  Brush:    (p)=> <Icon {...p} d="M9 14c-2 0-4 1-4 5 4 0 5-2 5-4M14 4l6 6-6 6-3-3 6-6z"/>,
  Lasso:    (p)=> <Icon {...p} d={<><path d="M7 22c-3-1-4-3-3-5"/><ellipse cx="13" cy="9" rx="9" ry="6"/><path d="M11 15c-3 5-4 6-7 7"/></>}/>,
  Eraser:   (p)=> <Icon {...p} d="M18 13.3 9.7 5l-7 7 6 6h8l4-4-2.4-.7zM10 19l-4-4"/>,
  ZoomIn:   (p)=> <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></>}/>,
  ZoomOut:  (p)=> <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></>}/>,
  Hand:     (p)=> <Icon {...p} d="M7 11V6a1.5 1.5 0 0 1 3 0v5M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V5.5a1.5 1.5 0 0 1 3 0V13M16 7.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1a8 8 0 0 1-7-4.5L3 14c-.5-1 .2-2 1.4-2L7 13"/>,
  Undo:     (p)=> <Icon {...p} d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4"/>,
  Redo:     (p)=> <Icon {...p} d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h4"/>,
  Export:   (p)=> <Icon {...p} d="M12 3v13M7 8l5-5 5 5M5 21h14"/>,
  Upload:   (p)=> <Icon {...p} d="M12 16V4M7 9l5-5 5 5M5 20h14"/>,
  Folder:   (p)=> <Icon {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>,
  Bell:     (p)=> <Icon {...p} d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 0 0 4 0"/>,
  Sun:      (p)=> <Icon {...p} d={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>}/>,
  Maximize: (p)=> <Icon {...p} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>,
  Check:    (p)=> <Icon {...p} d="M4 12l5 5L20 6"/>,
  X:        (p)=> <Icon {...p} d="M6 6l12 12M6 18 18 6"/>,
  Alert:    (p)=> <Icon {...p} d={<><path d="M12 2 2 21h20L12 2z"/><path d="M12 9v5M12 17.5v.5"/></>}/>,
  Info:     (p)=> <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 8v.5M11 12h1v5h1"/></>}/>,
  Crop:     (p)=> <Icon {...p} d="M6 2v16h16M2 6h16v16"/>,
  Slider:   (p)=> <Icon {...p} d="M4 6h16M4 12h16M4 18h16M9 6v0M16 12v0M11 18v0"/>,
  Wand:     (p)=> <Icon {...p} d="m4 20 14-14M16 4l2 2M18 2l2 2M14 6l2 2M6 18l2 2"/>,
  Lock:     (p)=> <Icon {...p} d={<><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>}/>,
  Cube:     (p)=> <Icon {...p} d="M12 2 3 7v10l9 5 9-5V7l-9-5zM3 7l9 5 9-5M12 12v10"/>,
  Sparkle:  (p)=> <Icon {...p} d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>,
  Plus:     (p)=> <Icon {...p} d="M12 5v14M5 12h14"/>,
  Minus:    (p)=> <Icon {...p} d="M5 12h14"/>,
  Eye:      (p)=> <Icon {...p} d={<><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>}/>,
  Image:    (p)=> <Icon {...p} d={<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 17-6-6-9 9"/></>}/>,
  Lightning:(p)=> <Icon {...p} d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>,
};

window.I = I;
window.Icon = Icon;
