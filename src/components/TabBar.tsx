import { Image, Layers, Box, Zap, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { TabKey } from '../data/models';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; fkey: string }[] = [
  { key: 'gallery',  label: 'Gallery',         icon: <Image size={14} />,             fkey: 'F1' },
  { key: 'workshop', label: 'Session Workshop', icon: <Layers size={14} />,            fkey: 'F2' },
  { key: 'streams',  label: 'Image Streams',    icon: <Box size={14} />,               fkey: 'F3' },
  { key: 'print',    label: 'Output',           icon: <Zap size={14} />,               fkey: 'F4' },
  { key: 'config',   label: 'Configuration',    icon: <SlidersHorizontal size={14} />, fkey: 'F5' },
];

export function TabBar() {
  const { activeTab, setTab } = useApp();
  return (
    <div className="tabbar">
      {TABS.map(t => (
        <div key={t.key} className={`tab ${activeTab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
          {t.icon}
          <span style={{ fontWeight: activeTab === t.key ? 600 : 400 }}>{t.label}</span>
          <span className="fkey">{t.fkey}</span>
        </div>
      ))}
    </div>
  );
}
