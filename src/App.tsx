import { useState, useEffect, memo } from 'react';
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

const PlaceholderTab = memo(function PlaceholderTab({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', gap: 12 }}>
      <span className="mono" style={{ fontSize: 11 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>— coming in Phase 3+</span>
    </div>
  );
});

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

  // Gallery and Workshop stay mounted across switches so the browser's image decode
  // cache stays warm — switching back is instant after the first load.
  // ImageStreams is conditional because it has a 2-second polling loop.
  const renderBody = () => {
    if (activeTab === 'streams') {
      return <ImageStreamsCenter />;
    }
    return (
      <>
        <LeftPanel />
        <div style={{ display: activeTab === 'gallery' ? 'contents' : 'none' }}>
          <GalleryCenter />
          <GalleryRight />
        </div>
        <div style={{ display: activeTab === 'workshop' ? 'contents' : 'none' }}>
          <CenterPanel
            activePhoto={activePhoto} setActivePhoto={setActivePhoto}
            split={split}             setSplit={setSplit}
            zoom={zoom}               setZoom={setZoom}
            activeTool={activeTool}   setActiveTool={setActiveTool}
          />
          <RightPanel />
        </div>
        {(activeTab === 'print' || activeTab === 'config') && (
          <PlaceholderTab label={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} />
        )}
      </>
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflow: 'hidden' }}>
      <div style={{ width: 1440, height: 900, transform: `scale(${scale})`, transformOrigin: 'center center', flex: '0 0 auto' }}>
        <div className="app">
          <TopBar />
          <div className={`body ${activeTab === 'streams' ? 'stream-body' : ''}`}>
            {renderBody()}
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
