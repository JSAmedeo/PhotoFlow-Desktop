// Gallery page — segmented thumbnail viewer + preview pane.
const { useState: useStateG } = React;

const GalleryCenter = ({ selectedSession, setSelectedSession, selectedHour, setTab }) => {
  const [search, setSearch] = useStateG("");
  const [filter, setFilter] = useStateG("All");
  const short = (window.HOUR_SHORT && window.HOUR_SHORT[selectedHour]) || selectedHour;
  return (
    <div className="panel center" style={{display:'flex',flexDirection:'column',minHeight:0}}>
      {/* Toolbar */}
      <div className="row" style={{padding:'8px 14px',borderBottom:'1px solid var(--line)',background:'var(--bg-1)',gap:10}}>
        <div className="row gap-2">
          <span className="uppercase">Gallery</span>
          <span className="mono pill accent">{short}</span>
          <span className="mono" style={{fontSize:10.5,color:'var(--ink-3)'}}>{SESSIONS.length} sessions · {SESSIONS.reduce((s,x)=>s+x.count,0)} images</span>
        </div>
        <div className="grow"/>
        <div className="row gap-2" style={{background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:3,padding:'4px 8px',width:240}}>
          <I.Search size={12} style={{color:'var(--ink-4)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search session ID..."
            style={{background:'transparent',border:'none',outline:'none',color:'var(--ink)',fontFamily:'JetBrains Mono',fontSize:11,flex:1,width:'100%'}}/>
        </div>
        <div className="seg" style={{minWidth:200}}>
          {["All","Flagged","Processed","Pending"].map(t=>(
            <button key={t} className={filter===t?'on':''} onClick={()=>setFilter(t)}>{t}</button>
          ))}
        </div>
        <button className="icon-btn"><I.Sort size={13}/></button>
        <button className="icon-btn"><I.Refresh size={13}/></button>
      </div>
      {/* Grid */}
      <div className="panel-scroll grow" style={{padding:'8px 0'}}>
        {SESSIONS.map(s => (
          <div key={s.code} style={{padding:'10px 14px',borderBottom:'1px solid var(--line-soft)',background:selectedSession===s.code?'rgba(61,214,196,0.04)':'transparent'}}
               onClick={()=>setSelectedSession(s.code)}>
            <div className="row" style={{justifyContent:'space-between',marginBottom:8}}>
              <div className="row gap-2">
                <span className="mono" style={{fontSize:12,fontWeight:600,color:selectedSession===s.code?'var(--accent)':'var(--ink)'}}>{s.code}</span>
                {s.flagged && <span className="pill" style={{color:'var(--warn)',borderColor:'rgba(232,176,74,0.4)',background:'rgba(232,176,74,0.1)'}}><I.Flag size={10}/> Flagged</span>}
                <span className="mono" style={{fontSize:10.5,color:'var(--ink-4)'}}>{s.time}</span>
                <span className="mono" style={{fontSize:10.5,color:'var(--ink-4)'}}>· {s.count} images</span>
              </div>
              <div className="row gap-2">
                <button className="btn ghost" style={{padding:'3px 8px',fontSize:10.5}}><I.Eye size={11}/> Preview</button>
                <button className="btn" style={{padding:'3px 8px',fontSize:10.5}} onClick={(e)=>{e.stopPropagation();setSelectedSession(s.code);setTab('workshop');}}><I.Layers size={11}/> Open in Workshop</button>
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {s.photos.map((p,i)=>(
                <div key={i} style={{width:84,height:84,borderRadius:3,border:`1px solid ${selectedSession===s.code && i===0?'var(--accent)':'var(--line)'}`,overflow:'hidden',position:'relative',cursor:'pointer'}}>
                  <Tile tint={s.tint} size={84} sessionPos={s.code+i}/>
                  <div style={{position:'absolute',top:3,left:3,background:'rgba(0,0,0,0.65)',color:'#fff',fontFamily:'JetBrains Mono',fontSize:9,padding:'1px 4px',borderRadius:2}}>{`#${String(i+1).padStart(2,'0')}`}</div>
                  {s.flagged && i===0 && <div style={{position:'absolute',top:3,right:3,width:6,height:6,borderRadius:'50%',background:'var(--warn)'}}/>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const GalleryRight = ({ selectedSession, setTab }) => {
  const s = SESSIONS.find(x=>x.code===selectedSession) || SESSIONS[0];
  return (
    <div className="panel right">
      <div className="panel-scroll grow">
        <div className="panel-section">
          <div className="uppercase" style={{marginBottom:8}}>Preview</div>
          <div style={{width:'100%',aspectRatio:'4 / 3',borderRadius:3,overflow:'hidden',border:'1px solid var(--line)',background:'#000',position:'relative'}}>
            <PhotoSVG variant="before" w="100%" h="100%" style={{position:'absolute',inset:0}}/>
            <div style={{position:'absolute',bottom:6,left:6,right:6,display:'flex',justifyContent:'space-between',fontFamily:'JetBrains Mono',fontSize:9.5,color:'rgba(255,255,255,0.85)'}}>
              <span style={{background:'rgba(0,0,0,0.55)',padding:'2px 5px',borderRadius:2}}>{s.code}</span>
              <span style={{background:'rgba(0,0,0,0.55)',padding:'2px 5px',borderRadius:2}}>#01 / {String(s.count).padStart(2,'0')}</span>
            </div>
          </div>
          <div className="row gap-2" style={{marginTop:8}}>
            <button className="icon-btn"><I.ChevLeft size={13}/></button>
            <div className="grow"/>
            <div style={{display:'flex',gap:4}}>
              {s.photos.map((p,i)=>(
                <div key={i} style={{width:30,height:30,borderRadius:2,border:`1px solid ${i===0?'var(--accent)':'var(--line)'}`,overflow:'hidden'}}>
                  <Tile tint={s.tint} size={30} sessionPos={s.code+i+'r'}/>
                </div>
              ))}
            </div>
            <div className="grow"/>
            <button className="icon-btn"><I.ChevRight size={13}/></button>
          </div>
        </div>
        <div className="panel-section">
          <div className="uppercase" style={{marginBottom:8}}>Session Info</div>
          <div className="col" style={{gap:5}}>
            {[
              ["Session", s.code],
              ["Captured", s.time],
              ["Location", "Giraffes · XYZ-GIR"],
              ["Images", `${s.count} frames`],
              ["Handler", "A. Patel"],
              ["Status", s.flagged?"Flagged · review":"Processed"],
            ].map(([k,v])=>(
              <div key={k} className="row" style={{justifyContent:'space-between',fontSize:11}}>
                <span style={{color:'var(--ink-3)'}}>{k}</span>
                <span className="mono" style={{color:k==='Status'&&s.flagged?'var(--warn)':'var(--ink)'}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel-section">
          <div className="uppercase" style={{marginBottom:8}}>Processing</div>
          <div className="col" style={{gap:5}}>
            {[
              ["Background", "Removed · Local"],
              ["Enhancement", "Real-ESRGAN + GFPGAN"],
              ["Upscale", "2× · 12000×8000"],
              ["Format", "JPEG q92"],
            ].map(([k,v])=>(
              <div key={k} className="row" style={{justifyContent:'space-between',fontSize:11}}>
                <span style={{color:'var(--ink-3)'}}>{k}</span>
                <span className="mono" style={{color:'var(--ink)'}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel-section" style={{borderBottom:'none'}}>
          <div className="col" style={{gap:6}}>
            <button className="btn primary block" onClick={()=>setTab('workshop')}><I.Layers size={13}/> Open in Workshop</button>
            <button className="btn block"><I.Star size={12}/> Favorite session</button>
            <button className="btn block"><I.Flag size={12}/> {s.flagged?'Unflag':'Flag for review'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

window.GalleryCenter = GalleryCenter;
window.GalleryRight = GalleryRight;
