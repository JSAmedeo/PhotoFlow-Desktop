import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';
import { TabBar } from './components/TabBar';
import { LeftPanel } from './components/LeftPanel';
import { GalleryCenter } from './features/gallery/GalleryCenter';
import { GalleryRight } from './features/gallery/GalleryRight';
import { ImageStreamsCenter } from './features/streams/ImageStreamsCenter';
import { CenterPanel } from './features/workshop/CenterPanel';
import { RightPanel } from './features/workshop/RightPanel';

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', gap: 12 }}>
      <span className="mono" style={{ fontSize: 11 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>— coming in Phase 3+</span>
    </div>
  );
}

// Inner shell — has access to AppContext
function Shell() {
  const { activeTab, isLoading } = useApp();

  // UI-only state — does not belong in context
  const [activePhoto, setActivePhoto] = useState(1);
  const [split,       setSplit]       = useState(50);
  const [zoom,        setZoom]        = useState(100);
  const [activeTool,  setActiveTool]  = useState('brush');
  const [scale,       setScale]       = useState(1);

  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth  || 1440;
      const h = window.innerHeight || 900;
      setScale(Math.max(0.05, Math.min(w / 1440, h / 900)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  if (isLoading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <div className="spin" style={{ width: 20, height: 20 }} />
      </div>
    );
  }

  const renderCenter = () => {
    if (activeTab === 'gallery')  return <GalleryCenter />;
    if (activeTab === 'streams') return <ImageStreamsCenter />;
    if (activeTab === 'workshop') return (
      <CenterPanel
        activePhoto={activePhoto} setActivePhoto={setActivePhoto}
        split={split}             setSplit={setSplit}
        zoom={zoom}               setZoom={setZoom}
        activeTool={activeTool}   setActiveTool={setActiveTool}
      />
    );
    return <PlaceholderTab label={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} />;
  };

  const renderRight = () => {
    if (activeTab === 'gallery')  return <GalleryRight />;
    if (activeTab === 'workshop') return <RightPanel />;
    return null;
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflow: 'hidden' }}>
      <div style={{ width: 1440, height: 900, transform: `scale(${scale})`, transformOrigin: 'center center', flex: '0 0 auto' }}>
        <div className="app">
          <TopBar />
          <div className={`body ${activeTab === 'streams' ? 'stream-body' : ''}`}>
            {activeTab === 'streams' ? (
              <ImageStreamsCenter />
            ) : (
              <>
                <LeftPanel />
                {renderCenter()}
                {renderRight()}
              </>
            )}
          </div>
          <TabBar />
          <StatusBar />
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
