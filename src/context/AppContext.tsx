// Centralized data state for PhotoFlow Desktop.
// Owns: sessions, photos, selected session/photo, active tab, selected hour, filter, loading.
// Does NOT own: zoom, activeTool, split position — those stay as local UI state in App.tsx.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type {
  Session,
  Photo,
  CaptureLocation,
  HourBucket,
  TabKey,
  FilterKey,
  ImportQueueItem,
  WatchedFolderSettings,
  WatcherRuntimeState,
} from '../data/models';
import {
  initStore,
  getSessions, getPhotos, getPhotosBySessionId, getLocations, getHours,
  getSelectedSessionId, setSelectedSessionId,
  getSelectedPhotoId,   setSelectedPhotoId,
  getActiveTab,         setActiveTab,
  getSelectedHour,      setSelectedHour,
  resetDemoData,
  updatePhotoMetadata as repoUpdatePhoto,
  deletePhotos as repoDeletePhotos,
  getImportQueue,
  importPhotosToSession as repoImportPhotos,
  clearCompletedImports as repoClearCompletedImports,
  clearImportQueue as repoClearImportQueue,
  getWatchedFolderSettings as repoGetWatchedFolderSettings,
  setWatchedFolderSettings as repoSetWatchedFolderSettings,
} from '../data/repository';
import { resolvePhotoSources } from '../storage/photoSourceResolver';
import { isTauriRuntime } from '../runtime/runtime';
import { startWatchedFolder, stopWatchedFolder } from '../ingest/watchedFolderService';

interface AppState {
  sessions:          Session[];
  allPhotos:         Photo[];
  photos:            Photo[];
  locations:         CaptureLocation[];
  hours:             HourBucket[];
  importQueue:       ImportQueueItem[];
  selectedSessionId: string;
  selectedPhotoId:   string;
  selectedPhotoIds:  string[];
  activeTab:         TabKey;
  selectedHour:      string;
  filter:            FilterKey;
  watchedFolderSettings: WatchedFolderSettings;
  watcherRuntime: WatcherRuntimeState;
  isLoading:         boolean;
}

interface AppActions {
  selectSession:   (id: string) => void;
  selectPhoto:     (id: string) => void;
  togglePhotoSelection: (id: string) => void;
  selectPhotoRange: (id: string) => void;
  clearPhotoSelection: () => void;
  deleteSelectedPhotos: () => Promise<void>;
  setTab:          (tab: TabKey) => void;
  setHour:         (h: string) => void;
  setFilter:       (f: FilterKey) => void;
  toggleFavorite:  (photoId: string) => void;
  toggleFlag:      (photoId: string) => void;
  importPhotosToActiveSession: (files: File[]) => Promise<void>;
  clearCompletedImports: () => void;
  clearImportQueue: () => void;
  chooseWatchedFolder: () => Promise<void>;
  updateWatchedFolderSettings: (changes: Partial<WatchedFolderSettings>) => Promise<void>;
  resetDemo:       () => void;
}

type AppContextValue = AppState & AppActions;

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_WATCHED_FOLDER_SETTINGS: WatchedFolderSettings = {
  watchEnabled: false,
  watchedImportFolder: null,
  fileSettleDelayMs: 2000,
  defaultCaptureLocationId: 'loc-2',
  defaultSessionAssignmentMode: 'active-session',
};

async function getResolvedPhotoState(sessionId: string): Promise<{ allPhotos: Photo[]; photos: Photo[] }> {
  const allResolvedPhotos = await resolvePhotoSources(await getPhotos());
  return {
    allPhotos: allResolvedPhotos,
    photos: allResolvedPhotos.filter(photo => photo.sessionId === sessionId),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessions,          setSessions]          = useState<Session[]>([]);
  const [allPhotos,         setAllPhotos]         = useState<Photo[]>([]);
  const [photos,            setPhotos]            = useState<Photo[]>([]);
  const [locations,         setLocations]         = useState<CaptureLocation[]>([]);
  const [hours,             setHours]             = useState<HourBucket[]>([]);
  const [importQueue,       setImportQueue]       = useState<ImportQueueItem[]>([]);
  const [selectedSessionId, setSession]           = useState<string>('');
  const [selectedPhotoId,   setPhoto]             = useState<string>('');
  const [selectedPhotoIds,  setSelectedPhotoIds]  = useState<string[]>([]);
  const [activeTab,         setTabState]          = useState<TabKey>('gallery');
  const [selectedHour,      setHourState]         = useState<string>('14:00');
  const [filter,            setFilterState]       = useState<FilterKey>('All');
  const [watchedFolderSettings, setWatchedFolderSettingsState] = useState<WatchedFolderSettings>(DEFAULT_WATCHED_FOLDER_SETTINGS);
  const [watcherRuntime, setWatcherRuntime] = useState<WatcherRuntimeState>({
    status: isTauriRuntime() ? 'off' : 'desktop-only',
  });
  const [isLoading,         setIsLoading]         = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initStore();
        const sessionId = await getSelectedSessionId();
        const photoId   = await getSelectedPhotoId();
        const resolved  = await getResolvedPhotoState(sessionId);
        setSessions(await getSessions());
        setAllPhotos(resolved.allPhotos);
        setPhotos(resolved.photos);
        setLocations(await getLocations());
        setHours(await getHours());
        setImportQueue(await getImportQueue());
        const watcherSettings = await repoGetWatchedFolderSettings();
        setWatchedFolderSettingsState(watcherSettings);
        setSession(sessionId);
        setPhoto(photoId);
        setSelectedPhotoIds(photoId ? [photoId] : []);
        setTabState(await getActiveTab());
        setHourState(await getSelectedHour());
      } catch (error) {
        console.error('[PhotoFlow] Failed to initialize app data.', error);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const refreshData = useCallback(async (sessionId = selectedSessionId) => {
    const resolved = await getResolvedPhotoState(sessionId);
    setSessions(await getSessions());
    setAllPhotos(resolved.allPhotos);
    setPhotos(resolved.photos);
    setImportQueue(await getImportQueue());
  }, [selectedSessionId]);

  useEffect(() => {
    if (isLoading) return undefined;

    if (!isTauriRuntime()) {
      setWatcherRuntime({ status: 'desktop-only' });
      return undefined;
    }

    void startWatchedFolder({
      settings: watchedFolderSettings,
      sessionId: selectedSessionId,
      onStatus: setWatcherRuntime,
      onImported: async () => {
        await refreshData(selectedSessionId);
      },
    });

    return () => {
      void stopWatchedFolder();
    };
  }, [isLoading, refreshData, selectedSessionId, watchedFolderSettings]);

  const selectSession = useCallback((id: string) => {
    void (async () => {
      setSession(id);
      await setSelectedSessionId(id);
      const firstPhoto = (await getPhotosBySessionId(id))[0];
      const photoId = firstPhoto?.id ?? '';
      setPhoto(photoId);
      setSelectedPhotoIds(photoId ? [photoId] : []);
      await setSelectedPhotoId(photoId);
      await refreshData(id);
    })();
  }, [refreshData]);

  const selectPhoto = useCallback((id: string) => {
    setPhoto(id);
    setSelectedPhotoIds(id ? [id] : []);
    void setSelectedPhotoId(id);
  }, []);

  const togglePhotoSelection = useCallback((id: string) => {
    setPhoto(id);
    void setSelectedPhotoId(id);
    setSelectedPhotoIds(current => (
      current.includes(id)
        ? current.filter(photoId => photoId !== id)
        : [...current, id]
    ));
  }, []);

  const selectPhotoRange = useCallback((id: string) => {
    setPhoto(id);
    void setSelectedPhotoId(id);
    setSelectedPhotoIds(current => {
      const anchorId = current[current.length - 1] ?? selectedPhotoId;
      const anchorIndex = photos.findIndex(photo => photo.id === anchorId);
      const targetIndex = photos.findIndex(photo => photo.id === id);
      if (anchorIndex < 0 || targetIndex < 0) return [id];
      const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      return photos.slice(start, end + 1).map(photo => photo.id);
    });
  }, [photos, selectedPhotoId]);

  const clearPhotoSelection = useCallback(() => {
    setSelectedPhotoIds([]);
  }, []);

  const setTab = useCallback((tab: TabKey) => {
    setTabState(tab);
    void setActiveTab(tab);
  }, []);

  const setHour = useCallback((h: string) => {
    setHourState(h);
    void setSelectedHour(h);
  }, []);

  const setFilter = useCallback((f: FilterKey) => {
    setFilterState(f);
  }, []);

  const toggleFavorite = useCallback((photoId: string) => {
    void (async () => {
      const target = (await getPhotos()).find(photo => photo.id === photoId);
      if (!target) return;
      await repoUpdatePhoto(photoId, { isFavorite: !target.isFavorite });
      await refreshData(selectedSessionId);
    })();
  }, [refreshData, selectedSessionId]);

  const toggleFlag = useCallback((photoId: string) => {
    void (async () => {
      const target = (await getPhotos()).find(photo => photo.id === photoId);
      if (!target) return;
      const nextFlag: Photo['flag'] = target.flag === 'flagged' ? 'none' : 'flagged';
      await repoUpdatePhoto(photoId, { flag: nextFlag });
      await refreshData(selectedSessionId);
    })();
  }, [refreshData, selectedSessionId]);

  const importPhotosToActiveSession = useCallback(async (files: File[]) => {
    if (!selectedSessionId || files.length === 0) return;
    const imported = await repoImportPhotos(selectedSessionId, files);
    await refreshData(selectedSessionId);
    const firstImported = imported[0];
    if (firstImported) {
      setPhoto(firstImported.id);
      await setSelectedPhotoId(firstImported.id);
    }
  }, [refreshData, selectedSessionId]);

  const clearCompletedImports = useCallback(() => {
    void (async () => {
      await repoClearCompletedImports();
      setImportQueue(await getImportQueue());
    })();
  }, []);

  const clearImportQueue = useCallback(() => {
    void (async () => {
      await repoClearImportQueue();
      setImportQueue([]);
    })();
  }, []);

  const deleteSelectedPhotos = useCallback(async () => {
    const idsToDelete = selectedPhotoIds.length > 0 ? selectedPhotoIds : selectedPhotoId ? [selectedPhotoId] : [];
    if (idsToDelete.length === 0) return;

    await repoDeletePhotos(idsToDelete);
    const remaining = (await getPhotosBySessionId(selectedSessionId)).filter(photo => !idsToDelete.includes(photo.id));
    const nextPhotoId = remaining[0]?.id ?? '';
    setSelectedPhotoIds(nextPhotoId ? [nextPhotoId] : []);
    setPhoto(nextPhotoId);
    await setSelectedPhotoId(nextPhotoId);
    await refreshData(selectedSessionId);
  }, [refreshData, selectedPhotoId, selectedPhotoIds, selectedSessionId]);

  const updateWatchedFolderSettings = useCallback(async (changes: Partial<WatchedFolderSettings>) => {
    const next = { ...watchedFolderSettings, ...changes };
    setWatchedFolderSettingsState(next);
    await repoSetWatchedFolderSettings(next);
  }, [watchedFolderSettings]);

  const chooseWatchedFolder = useCallback(async () => {
    if (!isTauriRuntime()) return;

    try {
      const dialog = await import('@tauri-apps/plugin-dialog');
      const selected = await dialog.open({
        directory: true,
        multiple: false,
      });

      if (typeof selected !== 'string') return;

      await updateWatchedFolderSettings({
        watchedImportFolder: selected,
      });
      setWatcherRuntime({
        status: watchedFolderSettings.watchEnabled ? 'watching' : 'off',
        lastImport: 'Watched folder configured.',
      });
    } catch (error) {
      setWatcherRuntime({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not choose watched folder.',
      });
    }
  }, [updateWatchedFolderSettings, watchedFolderSettings.watchEnabled]);

  const resetDemo = useCallback(() => {
    void (async () => {
      const freshSessions = await resetDemoData();
      const defaultId = freshSessions.find(session => session.id === 's-05')?.id ?? freshSessions[0]?.id ?? '';
      setSessions(freshSessions);
      setSession(defaultId);
      setPhoto(`${defaultId}-p1`);
      setSelectedPhotoIds([`${defaultId}-p1`]);
      await setSelectedSessionId(defaultId);
      await setSelectedPhotoId(`${defaultId}-p1`);
      const resolved = await getResolvedPhotoState(defaultId);
      setPhotos(resolved.photos);
      setAllPhotos(resolved.allPhotos);
      setLocations(await getLocations());
      setHours(await getHours());
      setImportQueue(await getImportQueue());
      const watcherSettings = await repoGetWatchedFolderSettings();
      setWatchedFolderSettingsState(watcherSettings);
      setTabState('gallery');
      setHourState('14:00');
      setFilterState('All');
    })();
  }, []);

  const value: AppContextValue = {
    sessions, allPhotos, photos, locations, hours, importQueue,
    selectedSessionId, selectedPhotoId, selectedPhotoIds, activeTab, selectedHour, filter,
    watchedFolderSettings, watcherRuntime, isLoading,
    selectSession, selectPhoto, togglePhotoSelection, selectPhotoRange, clearPhotoSelection, deleteSelectedPhotos, setTab, setHour, setFilter,
    toggleFavorite, toggleFlag, importPhotosToActiveSession, clearCompletedImports, clearImportQueue,
    chooseWatchedFolder, updateWatchedFolderSettings, resetDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
