/* SnapDesk — Session Workshop view */
const { useState, useRef, useEffect, useCallback } = React;

// ----- Small UI primitives ----------------------------------------------------

const Slider = ({ value, onChange, min=0, max=100, suffix='' }) => {
  const ref = useRef(null);
  const dragging = useRef(false);
  const update = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onChange(Math.round(min + x*(max-min)));
  };
  useEffect(()=>{
    const m=(e)=>{ if(dragging.current) update(e); };
    const u=()=>{ dragging.current=false; };
    window.addEventListener('mousemove',m);
    window.addEventListener('mouseup',u);
    return ()=>{window.removeEventListener('mousemove',m);window.removeEventListener('mouseup',u);};
  });
  const pct = ((value-min)/(max-min))*100;
  return (
    <div className="slider" ref={ref}
      onMouseDown={(e)=>{dragging.current=true; update(e);}}>
      <div className="track"/>
      <div className="fill" style={{width:`${pct}%`}}/>
      <div className="knob" style={{left:`${pct}%`}}/>
    </div>
  );
};

const Seg = ({ value, onChange, options }) => (
  <div className="seg">
    {options.map(o => (
      <button key={o} className={value===o?'on':''} onClick={()=>onChange(o)}>{o}</button>
    ))}
  </div>
);

const Select = ({ value, onChange, options }) => {
  const [open,setOpen]=useState(false);
  return (
    <div style={{position:'relative'}}>
      <div className="select" onClick={()=>setOpen(o=>!o)}>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</span>
        <I.ChevDown size={14}/>
      </div>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--bg-3)',border:'1px solid var(--line)',borderRadius:3,zIndex:30,boxShadow:'0 8px 24px rgba(0,0,0,0.5)'}}>
          {options.map(o => (
            <div key={o} onClick={()=>{onChange(o);setOpen(false);}}
              style={{padding:'7px 9px',fontSize:11.5,color:o===value?'var(--accent)':'var(--ink-2)',cursor:'pointer'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg-4)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Check = ({ on, onClick, label }) => (
  <div className={`check ${on?'on':''}`} onClick={onClick}>
    <span className="box">{on && <I.Check size={9} stroke={3}/>}</span>
    {label}
  </div>
);

// ----- Thumbnail tile (colored stripe pattern with figure silhouette) ---------

const Tile = ({ tint, size=30, processed=false, flagged=false, sessionPos=0 }) => {
  // Each tile = simple bg tint + abstract silhouette of subjects
  const [a,b] = tint;
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" style={{display:'block'}}>
      <defs>
        <linearGradient id={`tg-${a}-${b}-${sessionPos}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={processed?'#ffffff':a}/>
          <stop offset="1" stopColor={processed?'#e6e9ee':b}/>
        </linearGradient>
      </defs>
      <rect width="30" height="30" fill={`url(#tg-${a}-${b}-${sessionPos})`}/>
      {/* faint figures */}
      <ellipse cx="11" cy="13" rx="3.5" ry="4" fill="rgba(0,0,0,0.18)"/>
      <ellipse cx="18" cy="11" rx="3.8" ry="4.4" fill="rgba(0,0,0,0.22)"/>
      <path d="M5 30 Q 15 18 25 30 Z" fill="rgba(0,0,0,0.25)"/>
      {flagged && <circle cx="26" cy="4" r="2" fill="#e8b04a"/>}
    </svg>
  );
};

// ----- Session photo placeholder (62x62) --------------------------------------

const SessionPhotoMini = ({ idx, active, status }) => {
  // Mini, color-shifted variants of the same scene
  const filters = [
    "saturate(1) brightness(1)",
    "saturate(0.95) brightness(1.05)",
    "saturate(1.1) brightness(0.95) hue-rotate(-6deg)",
    "saturate(0.9) brightness(0.95) hue-rotate(8deg)",
    "saturate(1.05) brightness(1.02) hue-rotate(-3deg)",
  ];
  return (
    <div className={`session-thumb ${active?'active':''}`}>
      <div style={{width:'100%',height:'100%',filter:filters[idx%filters.length],overflow:'hidden'}}>
        <PhotoSVG variant="before" w={62} h={62}/>
      </div>
      <div className="st-tag">{`#${String(idx).padStart(2,'0')}`}</div>
      {status==='done' && <div className="st-ok"><I.Check size={9} stroke={3}/></div>}
      {status==='warn' && <div className="st-warn"><I.Alert size={8} stroke={2.4}/></div>}
    </div>
  );
};

// ----- Top menu bar -----------------------------------------------------------

const TopBar = () => (
  <div className="topbar">
    <div className="row gap-2" style={{minWidth:240}}>
      <div style={{width:22,height:22,borderRadius:4,background:'linear-gradient(135deg,var(--accent),#1f6e64)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a1916" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
      </div>
      <div className="col" style={{lineHeight:1.05}}>
        <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.14em'}}>PHOTOFLOW <span style={{color:'var(--ink-4)',fontWeight:500}}>DESKTOP</span></div>
        <div className="mono" style={{fontSize:9.5,color:'var(--ink-4)',letterSpacing:'0.05em'}}>v3.1.2 · build 2026.05.10</div>
      </div>
    </div>
    <div className="grow"/>
    <div className="row gap-2 mono" style={{fontSize:10.5,color:'var(--ink-3)'}}>
      <span style={{color:'var(--ink-4)'}}>WORKSPACE</span>
      <span style={{color:'var(--ink-2)'}}>Operations</span>
      <I.ChevRight size={11} stroke={2} style={{color:'var(--ink-5)'}}/>
      <span style={{color:'var(--ink-2)'}}>Session Workshop</span>
      <I.ChevRight size={11} stroke={2} style={{color:'var(--ink-5)'}}/>
      <span style={{color:'var(--accent)'}}>Giraffes · Encounter</span>
    </div>
    <div className="grow"/>
    <div className="row gap-2">
      <button className="icon-btn"><I.Search size={14}/></button>
      <button className="icon-btn" style={{position:'relative'}}>
        <I.Bell size={14}/>
        <span style={{position:'absolute',top:5,right:5,width:6,height:6,borderRadius:'50%',background:'var(--warn)'}}/>
      </button>
      <button className="icon-btn"><I.Sun size={14}/></button>
    </div>
  </div>
);

// ----- Left panel -------------------------------------------------------------

const LOCATIONS = [
  { name:"Main Gate", code:"XYZ-MGT" },
  { name:"Giraffes",  code:"XYZ-GIR" },
  { name:"Pandas",    code:"XYZ-PND" },
  { name:"Statue",    code:"XYZ-STA" },
];

const LocationSelect = () => {
  const [loc, setLoc] = useState(LOCATIONS[1]);
  const [open, setOpen] = useState(false);
  return (
    <div style={{position:'relative'}}>
      <div className="select" onClick={()=>setOpen(o=>!o)}>
        <div className="row gap-2">
          <I.MapPin size={13} style={{color:'var(--accent)'}}/>
          <div className="col" style={{lineHeight:1.15}}>
            <div style={{fontSize:12,fontWeight:500}}>{loc.name}</div>
            <div className="mono" style={{fontSize:10,color:'var(--ink-4)'}}>{loc.code} · Encounter</div>
          </div>
        </div>
        <div className="row gap-2">
          <span style={{width:6,height:6,borderRadius:'50%',background:'var(--ok)',display:'inline-block'}}/>
          <I.ChevDown size={13}/>
        </div>
      </div>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--bg-3)',border:'1px solid var(--line)',borderRadius:3,zIndex:30,boxShadow:'0 8px 24px rgba(0,0,0,0.5)'}}>
          {LOCATIONS.map(o=>(
            <div key={o.code} onClick={()=>{setLoc(o);setOpen(false);}}
              style={{padding:'7px 9px',fontSize:11.5,color:o.code===loc.code?'var(--accent)':'var(--ink-2)',cursor:'pointer',display:'flex',justifyContent:'space-between'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg-4)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span>{o.name}</span>
              <span className="mono" style={{fontSize:10,color:'var(--ink-4)'}}>{o.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LeftPanel = ({ selectedHour, setSelectedHour, selectedSession, setSelectedSession }) => (
  <div className="panel left">
    <div className="panel-section">
      <div className="uppercase" style={{marginBottom:6}}>Capture Location</div>
      <LocationSelect/>
    </div>
    <div className="panel-section">
      <div className="uppercase" style={{marginBottom:6}}>Operating Date</div>
      <div className="row gap-2" style={{justifyContent:'space-between'}}>
        <button className="icon-btn"><I.ChevLeft size={14}/></button>
        <div className="row gap-2"><I.Cal size={13} style={{color:'var(--ink-3)'}}/><span style={{fontWeight:500,fontSize:12}}>Sun, May 10, 2026</span></div>
        <button className="icon-btn"><I.ChevRight size={14}/></button>
      </div>
    </div>
    <div className="panel-section tight">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="uppercase">Hourly Folders</div>
        <div className="mono" style={{fontSize:10,color:'var(--ink-4)'}}>{HOURS.reduce((s,h)=>s+h.count,0)} sessions</div>
      </div>
    </div>
    <div className="panel-scroll grow">
      {HOURS.map(h => (
        <div key={h.h}
          className={`hour-row ${selectedHour===h.h?'selected':''} ${h.count===0?'empty':''}`}
          onClick={()=>setSelectedHour(h.h)}>
          <div className="col">
            <div className="h-time">{h.label}</div>
            <div className="h-sub">{h.sub}</div>
          </div>
          <div className="row gap-2">
            {h.flagged>0 && <I.Flag size={11} style={{color:'var(--warn)'}}/>}
            <span className={`badge-count ${selectedHour===h.h?'accent':''}`}>{h.count}</span>
          </div>
        </div>
      ))}
    </div>
    <div className="panel-section" style={{borderTop:'1px solid var(--line)',borderBottom:'none',background:'var(--bg-1)'}}>
      <div className="uppercase" style={{marginBottom:6}}>Today at a glance</div>
      <div className="bars" style={{height:36,marginBottom:8}}>
        {HOURS.map((h,i)=>(
          <div key={i} className={`b ${h.h===selectedHour?'on':''}`} style={{height:`${Math.max(8,(h.count/72)*100)}%`,flex:1}}/>
        ))}
      </div>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="col" style={{lineHeight:1.2}}>
          <div className="mono" style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>471</div>
          <div className="mono" style={{fontSize:9,color:'var(--ink-4)'}}>SESSIONS</div>
        </div>
        <div className="col" style={{lineHeight:1.2}}>
          <div className="mono" style={{fontSize:14,fontWeight:600,color:'var(--warn)'}}>20</div>
          <div className="mono" style={{fontSize:9,color:'var(--ink-4)'}}>FLAGGED</div>
        </div>
        <div className="col" style={{lineHeight:1.2}}>
          <div className="mono" style={{fontSize:14,fontWeight:600,color:'var(--accent)'}}>3</div>
          <div className="mono" style={{fontSize:9,color:'var(--ink-4)'}}>QUEUE</div>
        </div>
      </div>
    </div>
  </div>
);

// ----- Hour filmstrip (under workbench) --------------------------------------

const HourFilmstrip = ({ selectedSession, setSelectedSession, selectedHour }) => (
  <div style={{borderTop:'1px solid var(--line)',background:'var(--bg-1)',display:'flex',flexDirection:'column',flexShrink:0}}>
    <div className="row" style={{padding:'6px 14px',borderBottom:'1px solid var(--line-soft)',gap:10}}>
      <span className="uppercase">{(window.HOUR_SHORT && window.HOUR_SHORT[selectedHour]) || selectedHour} Sessions</span>
      <span className="mono pill" style={{fontSize:10}}>{SESSIONS.length} sessions · {SESSIONS.reduce((s,x)=>s+x.count,0)} images</span>
      <div className="grow"/>
      <div className="row gap-2">
        <button className="icon-btn"><I.Filter size={13}/></button>
        <button className="icon-btn"><I.Sort size={13}/></button>
        <span className="vdivider" style={{height:14,margin:'0 2px'}}/>
        <button className="icon-btn"><I.ChevLeft size={14}/></button>
        <button className="icon-btn"><I.ChevRight size={14}/></button>
      </div>
    </div>
    <div style={{display:'flex',overflowX:'auto',padding:'10px 14px',gap:0,alignItems:'stretch'}}>
      {SESSIONS.map((s,si)=>(
        <React.Fragment key={s.code}>
          {si>0 && <div style={{width:1,background:'var(--line)',margin:'0 10px',flexShrink:0}}/>}
          <div
            onClick={()=>setSelectedSession(s.code)}
            style={{
              cursor:'pointer',
              padding:'5px 7px 6px',
              borderRadius:3,
              background:selectedSession===s.code?'rgba(61,214,196,0.08)':'transparent',
              border:selectedSession===s.code?'1px solid var(--accent-line)':'1px solid transparent',
              flexShrink:0,
            }}>
            <div className="row" style={{justifyContent:'space-between',marginBottom:5,gap:8}}>
              <span className="sg-code" style={{color:selectedSession===s.code?'var(--accent)':'var(--ink-2)'}}>{s.code}</span>
              <div className="row gap-1">
                {s.flagged && <I.Flag size={9} style={{color:'var(--warn)'}}/>}
                <span className="sg-time">{s.time.slice(0,5)}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:3}}>
              {s.photos.map((p,i)=>(
                <div key={i} className={`thumb-sq ${s.flagged && i===0?'flagged':''}`} style={{width:36,height:36}}>
                  <Tile tint={s.tint} size={36} sessionPos={s.code+i}/>
                </div>
              ))}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  </div>
);

// ----- Center panel: workbench -----------------------------------------------

const CenterPanel = ({ activePhoto, setActivePhoto, split, setSplit, zoom, setZoom, activeTool, setActiveTool, selectedSession, setSelectedSession, selectedHour }) => {
  const wrapRef = useRef(null);
  const draggingRef = useRef(false);
  const updateSplit = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    setSplit(Math.max(2, Math.min(98, x)));
  };
  useEffect(()=>{
    const m=(e)=>{ if(draggingRef.current) updateSplit(e); };
    const u=()=>{ draggingRef.current=false; document.body.style.cursor=''; };
    window.addEventListener('mousemove',m); window.addEventListener('mouseup',u);
    return ()=>{window.removeEventListener('mousemove',m);window.removeEventListener('mouseup',u);};
  });

  // Photo area dims — fixed aspect ratio, sizes to fit wrap
  const IMG_W = 820, IMG_H = 540;

  return (
    <div className="panel center">
      {/* Session header strip */}
      <div className="row" style={{padding:'8px 14px',borderBottom:'1px solid var(--line)',background:'var(--bg-1)',gap:14}}>
        <div className="row gap-2">
          <span className="uppercase">Active Session</span>
          <span className="mono pill accent">XYZ0001415</span>
        </div>
        <div className="row gap-2 mono" style={{fontSize:10.5,color:'var(--ink-3)'}}>
          <span>2:14:51 PM</span><span style={{color:'var(--ink-5)'}}>·</span>
          <span>4 photos</span><span style={{color:'var(--ink-5)'}}>·</span>
          <span>Giraffe encounter — Booth 02</span><span style={{color:'var(--ink-5)'}}>·</span>
          <span>Handler: A. Patel</span>
        </div>
        <div className="grow"/>
        <button className="btn ghost"><I.Star size={12}/> Favorite</button>
        <button className="btn ghost"><I.Flag size={12}/> Flag</button>
        <button className="btn ghost"><I.Info size={12}/> Metadata</button>
        <button className="btn ghost"><I.Maximize size={12}/></button>
      </div>

      {/* Photo strip for active session */}
      <div className="session-thumbs">
        {ACTIVE_PHOTOS.map(p => (
          <div key={p.idx} onClick={()=>setActivePhoto(p.idx)} style={{cursor:'pointer'}}>
            <SessionPhotoMini idx={p.idx} active={activePhoto===p.idx} status={p.status}/>
          </div>
        ))}
        <div className="session-thumb" style={{borderStyle:'dashed',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--ink-4)'}}>
          <I.Plus size={16}/>
        </div>
        <div className="grow"/>
        <div className="col" style={{alignItems:'flex-end',lineHeight:1.1}}>
          <div className="mono" style={{fontSize:11,color:'var(--ink)'}}>Frame {String(activePhoto).padStart(2,'0')} / 04</div>
          <div className="mono" style={{fontSize:10,color:'var(--ink-4)'}}>6000 × 4000 · 24.7 MB · CR3</div>
        </div>
        <button className="icon-btn"><I.ChevLeft size={14}/></button>
        <button className="icon-btn"><I.ChevRight size={14}/></button>
      </div>

      {/* Workbench */}
      <div className="workbench">
        <div className="compare-wrap">
          <div className="compare" ref={wrapRef}
            style={{width:'100%',height:'100%',maxWidth:IMG_W,maxHeight:IMG_H,aspectRatio:`${IMG_W} / ${IMG_H}`, '--split':`${split}%`}}>
            {/* Before pane — full colorful */}
            <div className="pane before">
              <PhotoSVG variant="before" w="100%" h="100%" style={{position:'absolute',inset:0}}/>
            </div>
            {/* After pane — checker (transparent) + subjects (no background) */}
            <div className="pane after">
              <div className="checker" style={{position:'absolute',inset:0}}/>
              <PhotoSVG variant="after" w="100%" h="100%" style={{position:'absolute',inset:0}}/>
            </div>
            {/* Splitter */}
            <div className="splitter"
              onMouseDown={(e)=>{draggingRef.current=true; document.body.style.cursor='ew-resize'; updateSplit(e);}}/>
            <div className="handle"
              onMouseDown={(e)=>{draggingRef.current=true; document.body.style.cursor='ew-resize'; updateSplit(e);}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M8 6 2 12l6 6M16 6l6 6-6 6"/></svg>
            </div>
            <div className="label l mono">BEFORE — ORIGINAL</div>
            <div className="label r mono">AFTER — PROCESSED · v2.4</div>
            <div className="meta">
              <div className="chip">f/4.0 · 1/250s · ISO 400 · 50mm</div>
              <div className="chip">RGB · 16-bit · Adobe RGB</div>
            </div>
            {/* zoom level corner */}
            <div style={{position:'absolute',bottom:38,right:10,fontFamily:'JetBrains Mono',fontSize:10,color:'rgba(255,255,255,0.6)',background:'rgba(0,0,0,0.5)',padding:'2px 6px',borderRadius:2,zIndex:4}}>
              {zoom}% · FIT
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="tool-group">
            {[
              ['brush','Brush','Brush'],
              ['lasso','Lasso','Lasso'],
              ['eraser','Erase','Eraser'],
              ['wand','Magic Wand','Wand'],
            ].map(([k,_,ico])=>(
              <button key={k} className={`icon-btn ${activeTool===k?'active':''}`} onClick={()=>setActiveTool(k)} title={_}>
                {React.createElement(I[ico],{size:14})}
              </button>
            ))}
          </div>
          <div className="tool-group">
            <button className={`icon-btn ${activeTool==='hand'?'active':''}`} onClick={()=>setActiveTool('hand')} title="Pan"><I.Hand size={14}/></button>
            <button className="icon-btn" onClick={()=>setZoom(Math.max(25,zoom-25))} title="Zoom out"><I.ZoomOut size={14}/></button>
            <span className="zoom-readout">{zoom}%</span>
            <button className="icon-btn" onClick={()=>setZoom(Math.min(400,zoom+25))} title="Zoom in"><I.ZoomIn size={14}/></button>
            <button className="icon-btn" onClick={()=>setZoom(100)} title="Fit"><I.Maximize size={14}/></button>
          </div>
          <div className="tool-group">
            <button className="icon-btn"><I.Undo size={14}/></button>
            <button className="icon-btn"><I.Redo size={14}/></button>
            <button className="icon-btn"><I.Layers size={14}/></button>
            <button className="icon-btn"><I.Crop size={14}/></button>
          </div>
          <div className="grow-spacer"/>
          <div className="row gap-2">
            <span className="key-readout"><span className="kbd">[</span> <span className="kbd">]</span> brush size · <span className="kbd">B</span> brush · <span className="kbd">L</span> lasso</span>
          </div>
          <div className="tool-group" style={{borderRight:'none',paddingRight:0}}>
            <button className="btn"><I.Eye size={12}/> Preview</button>
            <button className="btn primary"><I.Export size={12}/> Export</button>
          </div>
        </div>
      </div>
      <HourFilmstrip selectedSession={selectedSession} setSelectedSession={setSelectedSession} selectedHour={selectedHour}/>
    </div>
  );
};

// ----- Right panel: processing controls --------------------------------------

const RightPanel = () => {
  const [bgModel, setBgModel] = useState("Local Service - General Model");
  const [sensitivity, setSensitivity] = useState(72);
  const [feather, setFeather] = useState(18);
  const [sharp, setSharp] = useState(42);
  const [color, setColor] = useState(58);
  const [wb, setWb] = useState(50);
  const [denoise, setDenoise] = useState(34);
  const [exposure, setExposure] = useState(50);
  const [upscale, setUpscale] = useState('2×');
  const [upModel, setUpModel] = useState("Topaz Photo AI · Subject");
  const [format, setFormat] = useState("JPEG");
  const [autoApply, setAutoApply] = useState(true);
  const [enhAuto, setEnhAuto] = useState(true);
  const [enhModel, setEnhModel] = useState("Local Model - Real-ESRGAN + GFPGAN");

  const SectionHead = ({label, count, action}) => (
    <div className="row" style={{justifyContent:'space-between',marginBottom:8}}>
      <div className="uppercase">{label}</div>
      <div className="row gap-2">
        {count != null && <span className="mono" style={{fontSize:10,color:'var(--ink-4)'}}>{count}</span>}
        {action}
      </div>
    </div>
  );

  const Sliders = ({rows}) => (
    <div className="col" style={{gap:8}}>
      {rows.map(([label, val, setVal, fmt]) => (
        <div key={label}>
          <div className="ctrl-row">
            <span className="label">{label}</span>
            <span className="val">{fmt ? fmt(val) : val}</span>
          </div>
          <Slider value={val} onChange={setVal}/>
        </div>
      ))}
    </div>
  );

  return (
    <div className="panel right">
      <div className="panel-scroll grow">

        {/* Background removal */}
        <div className="panel-section">
          <SectionHead label="Background Removal" action={<Check on={autoApply} onClick={()=>setAutoApply(!autoApply)} label="Auto"/>}/>
          <div className="col gap-2" style={{gap:8}}>
            <div>
              <div className="ctrl-row"><span className="label">Model</span><span className="val">v3.1</span></div>
              <Select value={bgModel} onChange={setBgModel}
                options={["Local Service - General Model","Local Service - Special Model","Cloud Service - RemoveBG API","Cloud Service - Adobe"]}/>
            </div>
            <Sliders rows={[
              ["Sensitivity", sensitivity, setSensitivity, v=>`${v}%`],
              ["Edge feather", feather, setFeather, v=>`${v} px`],
            ]}/>
          </div>
        </div>

        {/* Image enhancement */}
        <div className="panel-section">
          <SectionHead label="Image Enhancement" count="5 active" action={<Check on={enhAuto} onClick={()=>setEnhAuto(!enhAuto)} label="Auto"/>}/>
          <div className="col" style={{gap:8}}>
            <div>
              <div className="ctrl-row"><span className="label">Model</span><span className="val">v2.4</span></div>
              <Select value={enhModel} onChange={setEnhModel}
                options={["Local Model - Real-ESRGAN + GFPGAN","Cloud Model - Topaz"]}/>
            </div>
            <Sliders rows={[
              ["Sharpness",       sharp,    setSharp,    v=>`+${v-50}`],
              ["Color correction",color,    setColor,    v=>`+${v-50}`],
              ["White balance",   wb,       setWb,       v=>`${v<50?'-':'+'}${Math.abs(v-50)*40} K`],
              ["Exposure",        exposure, setExposure, v=>`${v<50?'-':'+'}${(Math.abs(v-50)/50*1.8).toFixed(2)} EV`],
              ["Denoise",         denoise,  setDenoise,  v=>`${v}%`],
            ]}/>
          </div>
        </div>

        {/* Upscaling */}
        <div className="panel-section">
          <SectionHead label="Upscaling"/>
          <div className="col" style={{gap:8}}>
            <Seg value={upscale} onChange={setUpscale} options={["1×","2×","4×"]}/>
            <div>
              <div className="ctrl-row"><span className="label">Model</span><span className="val">{upscale==='4×'?'~5.2s/img':'~1.8s/img'}</span></div>
              <Select value={upModel} onChange={setUpModel}
                options={["Topaz Photo AI · Subject","Topaz Gigapixel · Standard","Real-ESRGAN · Anime","SwinIR · General"]}/>
            </div>
            <div className="row gap-2">
              <Check on={true} onClick={()=>{}} label="Preserve faces"/>
              <Check on={false} onClick={()=>{}} label="GFPGAN"/>
            </div>
          </div>
        </div>



        {/* Processing status */}
        <div className="panel-section" style={{borderBottom:'none'}}>
          <SectionHead label="Processing Queue" count="3 / 4"/>
          <div className="col" style={{gap:4}}>
            <div className="row" style={{justifyContent:'space-between',marginBottom:4}}>
              <span className="mono" style={{fontSize:10.5,color:'var(--ink-2)'}}>Batch · XYZ0001415</span>
              <span className="mono" style={{fontSize:10.5,color:'var(--accent)'}}>75%</span>
            </div>
            <div className="progress"><div className="bar" style={{width:'75%'}}/></div>
            <div style={{height:6}}/>
            {[
              {n:"XYZ0001501", s:"done",  msg:"Enhanced · upscaled · masked"},
              {n:"XYZ0001502", s:"done",  msg:"Enhanced · upscaled · masked"},
              {n:"XYZ0001503", s:"proc",  msg:"Upscaling · 2× · ETA 1.2s"},
              {n:"XYZ0001504", s:"warn",  msg:"Soft mask edge · review"},
            ].map(r=>(
              <div key={r.n} className="status-item">
                <span className="ico">
                  {r.s==='done' && <I.Check size={12} stroke={2.4} style={{color:'var(--ok)'}}/>}
                  {r.s==='proc' && <div className="spin"/>}
                  {r.s==='warn' && <I.Alert size={12} style={{color:'var(--warn)'}}/>}
                </span>
                <span className="mono" style={{color:'var(--ink-2)',width:54}}>{r.n}</span>
                <span style={{color:r.s==='warn'?'var(--warn)':'var(--ink-3)',fontSize:10.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.msg}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

// ----- Tab bar + status bar ---------------------------------------------------

const TabBar = ({ tab, setTab }) => (
  <div className="tabbar">
    {[
      ['gallery','Gallery','Image','F1'],
      ['workshop','Session Workshop','Layers','F2'],
      ['streams','Image Streams','Cube','F3'],
      ['print','Output','Lightning','F4'],
      ['config','Configuration','Slider','F5'],
    ].map(([k,label,ico,f])=>(
      <div key={k} className={`tab ${tab===k?'on':''}`} onClick={()=>setTab(k)}>
        {React.createElement(I[ico],{size:14})}
        <span style={{fontWeight:tab===k?600:400}}>{label}</span>
        <span className="fkey">{f}</span>
      </div>
    ))}
  </div>
);

const StatusBar = () => (
  <div className="statusbar">
    <span className="row gap-2"><span className="dot"/> CONNECTED</span>
    <span className="sep"/>
    <span>VENUE <span style={{color:'var(--ink)'}}>Giraffes</span></span>
    <span className="sep"/>
    <span>SESSION <span style={{color:'var(--ink)'}}>XYZ0001415</span></span>
    <span className="sep"/>
    <span>FRAME <span style={{color:'var(--ink)'}}>01/04</span></span>
    <span className="sep"/>
    <span>QUEUE <span style={{color:'var(--accent)'}}>3</span></span>
    <span className="sep"/>
    <span>TODAY <span style={{color:'var(--ink)'}}>471</span> sessions · <span style={{color:'var(--warn)'}}>20</span> flagged</span>
    <span className="spacer"/>
    <span>GPU <span style={{color:'var(--ink)'}}>RTX 4080</span></span>
    <span className="sep"/>
    <span>VRAM <span style={{color:'var(--ink)'}}>7.4 / 16 GB</span></span>
    <span className="sep"/>
    <span>GALLERY API <span style={{color:'var(--ok)'}}>SYNC OK</span> · 42 ms</span>
    <span className="sep"/>
    <span className="live">2:14:51 PM PDT</span>
  </div>
);

// ----- App --------------------------------------------------------------------

const App = () => {
  const [selectedHour, setSelectedHour] = useState("14:00");
  const [selectedSession, setSelectedSession] = useState("XYZ0001415");
  const [activePhoto, setActivePhoto] = useState(1);
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(100);
  const [activeTool, setActiveTool] = useState('brush');
  const [tab, setTab] = useState('workshop');

  return (
    <div className="app">
      <TopBar/>
      <div className="body">
        <LeftPanel
          selectedHour={selectedHour} setSelectedHour={setSelectedHour}
          selectedSession={selectedSession} setSelectedSession={setSelectedSession}/>
        {tab==='gallery' ? (
          <>
            <GalleryCenter selectedSession={selectedSession} setSelectedSession={setSelectedSession} selectedHour={selectedHour} setTab={setTab}/>
            <GalleryRight selectedSession={selectedSession} setTab={setTab}/>
          </>
        ) : (
          <>
            <CenterPanel
              activePhoto={activePhoto} setActivePhoto={setActivePhoto}
              split={split} setSplit={setSplit}
              zoom={zoom} setZoom={setZoom}
              activeTool={activeTool} setActiveTool={setActiveTool}
              selectedSession={selectedSession} setSelectedSession={setSelectedSession}
              selectedHour={selectedHour}/>
            <RightPanel/>
          </>
        )}
      </div>
      <TabBar tab={tab} setTab={setTab}/>
      <StatusBar/>
    </div>
  );
};

// Render with simple scale-to-fit
const Root = () => {
  const [scale, setScale] = useState(1);
  useEffect(()=>{
    const fit = () => {
      const w = window.innerWidth || document.documentElement.clientWidth || 1440;
      const h = window.innerHeight || document.documentElement.clientHeight || 900;
      const s = Math.min(w / 1440, h / 900);
      setScale(s > 0.05 ? s : 1);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  },[]);
  return (
    <div style={{width:'100vw',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#000',overflow:'hidden'}}>
      <div style={{width:1440,height:900,transform:`scale(${scale})`,transformOrigin:'center center',flex:'0 0 auto'}}>
        <App/>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<Root/>);
