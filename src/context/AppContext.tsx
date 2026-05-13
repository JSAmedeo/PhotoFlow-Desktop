// Centralized data state for PhotoFlow Desktop.
// Owns: sessions, photos, selected session/photo, active tab, selected hour, filter, loading.
// Does NOT own: zoom, activeTool, split position — those stay as local UI state in App.tsx.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, Photo, CaptureLocation, HourBucket, TabKey, FilterKey, ImportQueueItem } from '../data/models';
import {
  initStore,
  getSessions, getPhotos, getPhotosBySessionId, getLocations, getHours,
  getSelectedSessionId, setSelectedSessionId,
  getSelectedPhotoId,   setSelectedPhotoId,
  getActiveTab,         setActiveTab,
  getSelectedHour,      setSelectedHour,
  resetDemoData,
  updatePhotoMetadata as repoUpdatePhoto,
  getImportQueue,
  importPhotosToSession as repoImportPhotos,
  clearCompletedImports as repoClearCompletedImports,
  clearImportQueue as repoClearImportQueue,
} from '../data/repository';

interface AppState {
  sessions:          Session[];
  allPhotos:         Photo[];
  photos:            Photo[];          // photos for the selected session
  locations:         CaptureLocation[];
  hours:             HourBucket[];
  importQueue:       ImportQueueItem[];
  selectedSessionId: string;
  selectedPhotoId:   string;
  activeTab:         TabKey;
  selectedHour:      string;
  filter:            FilterKey;
  isLoading:         boolean;
}

interface AppActions {
  selectSession:   (id: string) => void;
  selectPhoto:     (id: string) => void;
  setTab:          (tab: TabKey) => void;
  setHour:         (h: string) => void;
  setFilter:       (f: FilterKey) => void;
  toggleFavorite:  (photoId: string) => void;
  toggleFlag:      (photoId: string) => void;
  importPhotosToActiveSession: (files: File[]) => Promise<void>;
  clearCompletedImports: () => void;
  clearImportQueue: () => void;
  resetDemo:       () => void;
}

type AppContextValue = AppState & AppActions;

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessions,          setSessions]          = useState<Session[]>([]);
  const [allPhotos,         setAllPhotos]         = useState<Photo[]>([]);
  const [photos,            setPhotos]            = useState<Photo[]>([]);
  const [locations,         setLocations]         = useState<CaptureLocation[]>([]);
  const [hours,             setHours]             = useState<HourBucket[]>([]);
  const [importQueue,       setImportQueue]       = useState<ImportQueueItem[]>([]);
  const [selectedSessionId, setSession]           = useState<string>('');
  const [selectedPhotoId,   setPhoto]             = useState<string>('');
  const [activeTab,         setTabState]          = useState<TabKey>('gallery');
  const [selectedHour,      setHourState]         = useState<string>('14:00');
  const [filter,            setFilterState]       = useState<FilterKey>('All');
  const [isLoading,         setIsLoading]         = useState(true);

  // Bootstrap: init store then load state
  useEffect(() => {
    initStore();
    const allSessions = getSessions();
    const sessionId   = getSelectedSessionId();
    const photoId     = getSelectedPhotoId();
    setSessions(allSessions);
    setAllPhotos(getPhotos());
    setPhotos(getPhotosBySessionId(sessionId));
    setLocations(getLocations());
    setHours(getHours());
    setImportQueue(getImportQueue());
    setSession(sessionId);
    setPhoto(photoId);
    setTabState(getActiveTab());
    setHourState(getSelectedHour());
    setIsLoading(false);
  }, []);

  const selectSession = useCallback((id: string) => {
    setSession(id);
    setSelectedSessionId(id);
    const firstPhoto = getPhotosBySessionId(id)[0];
    const photoId = firstPhoto?.id ?? '';
    setPhoto(photoId);
    setSelectedPhotoId(photoId);
    setPhotos(getPhotosBySessionId(id));
  }, []);

  const selectPhoto = useCallback((id: string) => {
    setPhoto(id);
    setSelectedPhotoId(id);
  }, []);

  const setTab = useCallback((tab: TabKey) => {
    setTabState(tab);
    setActiveTab(tab);
  }, []);

  const setHour = useCallback((h: string) => {
    setHourState(h);
    setSelectedHour(h);
  }, []);

  const setFilter = useCallback((f: FilterKey) => {
    setFilterState(f);
  }, []);

  const toggleFavorite = useCallback((photoId: string) => {
    setPhotos(prev => {
      const updated = prev.map(p => {
        if (p.id !== photoId) return p;
        const next = { ...p, isFavorite: !p.isFavorite };
        repoUpdatePhoto(photoId, { isFavorite: next.isFavorite });
        return next;
      });
      return updated;
    });
    setAllPhotos(getPhotos());
  }, []);

  const toggleFlag = useCallback((photoId: string) => {
    setPhotos(prev => prev.map(p => {
      if (p.id !== photoId) return p;
      const nextFlag: Photo['flag'] = p.flag === 'flagged' ? 'none' : 'flagged';
      repoUpdatePhoto(photoId, { flag: nextFlag });
      return { ...p, flag: nextFlag };
    }));
    setAllPhotos(getPhotos());
  }, []);

  const refreshData = useCallback((sessionId = selectedSessionId) => {
    setSessions(getSessions());
    setAllPhotos(getPhotos());
    setPhotos(getPhotosBySessionId(sessionId));
    setImportQueue(getImportQueue());
  }, [selectedSessionId]);

  const importPhotosToActiveSession = useCallback(async (files: File[]) => {
    if (!selectedSessionId || files.length === 0) return;
    const imported = await repoImportPhotos(selectedSessionId, files);
    refreshData(selectedSessionId);
    const firstImported = imported[0];
    if (firstImported) {
      setPhoto(firstImported.id);
      setSelectedPhotoId(firstImported.id);
    }
  }, [refreshData, selectedSessionId]);

  const clearCompletedImports = useCallback(() => {
    repoClearCompletedImports();
    setImportQueue(getImportQueue());
  }, []);

  const clearImportQueue = useCallback(() => {
    repoClearImportQueue();
    setImportQueue([]);
  }, []);

  const resetDemo = useCallback(() => {
    const freshSessions = resetDemoData();
    setSessions(freshSessions);
    const defaultId = freshSessions.find(s => s.id === 's-05')?.id ?? freshSessions[0]?.id ?? '';
    setSession(defaultId);
    setPhoto(`${defaultId}-p1`);
    setPhotos(getPhotosBySessionId(defaultId));
    setAllPhotos(getPhotos());
    setLocations(getLocations());
    setHours(getHours());
    setImportQueue(getImportQueue());
    setTabState('gallery');
    setHourState('14:00');
    setFilterState('All');
  }, []);

  const value: AppContextValue = {
    sessions, allPhotos, photos, locations, hours, importQueue,
    selectedSessionId, selectedPhotoId, activeTab, selectedHour, filter, isLoading,
    selectSession, selectPhoto, setTab, setHour, setFilter,
    toggleFavorite, toggleFlag, importPhotosToActiveSession, clearCompletedImports, clearImportQueue, resetDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Convenience hook — throws if used outside AppProvider
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
