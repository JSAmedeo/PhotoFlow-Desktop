// Centralized data state for PhotoFlow Desktop.
// Owns: sessions, photos, selected session/photo, active tab, selected hour, filter, loading.
// Does NOT own: zoom, activeTool, split position — those stay as local UI state in App.tsx.

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import type {
  Session,
  Photo,
  PhotoVersion,
  PhotoVersionKind,
  CaptureLocation,
  ImageStream,
  HourBucket,
  TabKey,
  FilterKey,
  ImportQueueItem,
  WatchedFolderSettings,
  WatcherRuntimeState,
  FileNamingField,
  FileNamingExtension,
  FileNamingSeparator,
  AutoPrintItem,
} from '../data/models';
import {
  initStore,
  getSessions, getPhotos, getPhotosBySessionId, getPhotoById, getLocations,
  getSelectedSessionId, setSelectedSessionId,
  getSelectedPhotoId,   setSelectedPhotoId,
  getActiveTab,         setActiveTab,
  getSelectedHour,      setSelectedHour,
  resetDemoData,
  deleteSession as repoDeleteSession,
  updatePhotoMetadata as repoUpdatePhoto,
  deletePhotos as repoDeletePhotos,
  getImportQueue,
  importPhotosToSession as repoImportPhotos,
  removeImportQueueItem as repoRemoveImportQueueItem,
  clearCompletedImports as repoClearCompletedImports,
  clearImportQueue as repoClearImportQueue,
  getWatchedFolderSettings as repoGetWatchedFolderSettings,
  setWatchedFolderSettings as repoSetWatchedFolderSettings,
  getImageStreams as repoGetImageStreams,
  createImageStream as repoCreateImageStream,
  updateImageStream as repoUpdateImageStream,
  deleteImageStream as repoDeleteImageStream,
  buildHourlyImportBuckets,
  getPhotoVersions as repoGetPhotoVersions,
  setActiveVersion as repoSetActiveVersion,
} from '../data/repository';
import { resolvePhotoSources } from '../storage/photoSourceResolver';
import { isTauriRuntime } from '../runtime/runtime';
import { startImageStreamWatchers, stopWatchedFolder } from '../ingest/watchedFolderService';

interface AppState {
  sessions:          Session[];
  allPhotos:         Photo[];
  photos:            Photo[];
  locations:         CaptureLocation[];
  imageStreams:      ImageStream[];
  hours:             HourBucket[];
  importQueue:       ImportQueueItem[];
  selectedSessionId: string;
  selectedPhotoId:   string;
  selectedPhotoIds:  string[];
  activeTab:         TabKey;
  selectedHour:      string;
  selectedLocationId: string;
  operatingDate:     Date;
  filter:            FilterKey;
  watchedFolderSettings: WatchedFolderSettings;
  watcherRuntime: WatcherRuntimeState;
  isLoading:         boolean;
}

interface AppActions {
  selectSession:   (id: string, preferredPhotoId?: string) => void;
  selectPhoto:     (id: string) => void;
  togglePhotoSelection: (id: string) => void;
  selectPhotoRange: (id: string) => void;
  clearPhotoSelection: () => void;
  deleteSelectedPhotos: () => Promise<void>;
  deleteSessionFromGallery: (sessionId: string) => Promise<void>;
  setTab:          (tab: TabKey) => void;
  setHour:           (h: string) => void;
  setLocationId:     (id: string) => void;
  setOperatingDate:  (d: Date) => void;
  setFilter:         (f: FilterKey) => void;
  toggleFavorite:  (photoId: string) => void;
  toggleFlag:      (photoId: string) => void;
  importPhotosToActiveSession: (files: File[]) => Promise<void>;
  removeImportQueueItem: (id: string) => void;
  clearCompletedImports: () => void;
  clearImportQueue: () => void;
  chooseWatchedFolder: () => Promise<void>;
  updateWatchedFolderSettings: (changes: Partial<WatchedFolderSettings>) => Promise<void>;
  refreshPhotoInPlace: (photoId: string) => Promise<void>;
  getPhotoVersions: (photoId: string) => Promise<PhotoVersion[]>;
  switchPhotoVersion: (photoId: string, kind: PhotoVersionKind) => Promise<void>;
  createImageStream: (input: { name: string; code?: string; watchPath?: string | null; enabled?: boolean; processingPreset?: string | null; printerName?: string | null; autoPrintEnabled?: boolean; autoPrintItems?: AutoPrintItem[]; autoEnhanceEnabled?: boolean; enhanceBrightness?: number; enhanceContrast?: number; enhanceSaturation?: number; enhanceSharpen?: number; fileRenamingEnabled?: boolean; fileNamingFields?: FileNamingField[]; fileNamingSeparator?: FileNamingSeparator; fileNamingExtension?: FileNamingExtension }) => Promise<void>;
  updateImageStream: (id: string, changes: Partial<ImageStream>) => Promise<void>;
  deleteImageStream: (id: string) => Promise<void>;
  chooseImageStreamFolder: (id: string) => Promise<void>;
  clearImageStreamFolder: (id: string) => Promise<void>;
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

async function applyFreshDemoState(
  freshSessions: Session[],
  setters: {
    setSessions: (sessions: Session[]) => void;
    setSession: (id: string) => void;
    setPhoto: (id: string) => void;
    setSelectedPhotoIds: (ids: string[]) => void;
    setPhotos: (photos: Photo[]) => void;
    setAllPhotos: (photos: Photo[]) => void;
    setLocations: (locations: CaptureLocation[]) => void;
    setImageStreams: (streams: ImageStream[]) => void;
    setImportQueue: (queue: ImportQueueItem[]) => void;
    setWatchedFolderSettingsState: (settings: WatchedFolderSettings) => void;
    setTabState: (tab: TabKey) => void;
    setHourState: (hour: string) => void;
    setFilterState: (filter: FilterKey) => void;
  },
): Promise<void> {
  const defaultId = freshSessions.find(session => session.id === 's-05')?.id ?? freshSessions[0]?.id ?? '';
  const defaultPhotoId = defaultId ? `${defaultId}-p1` : '';

  setters.setSessions(freshSessions);
  setters.setSession(defaultId);
  setters.setPhoto(defaultPhotoId);
  setters.setSelectedPhotoIds(defaultPhotoId ? [defaultPhotoId] : []);
  await setSelectedSessionId(defaultId);
  await setSelectedPhotoId(defaultPhotoId);
  const resolved = await getResolvedPhotoState(defaultId);
  setters.setPhotos(resolved.photos);
  setters.setAllPhotos(resolved.allPhotos);
  setters.setLocations(await getLocations());
  setters.setImageStreams(await repoGetImageStreams());
  setters.setImportQueue(await getImportQueue());
  setters.setWatchedFolderSettingsState(await repoGetWatchedFolderSettings());
  setters.setTabState('gallery');
  setters.setHourState('14:00');
  setters.setFilterState('All');
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessions,          setSessions]          = useState<Session[]>([]);
  const [allPhotos,         setAllPhotos]         = useState<Photo[]>([]);
  const [photos,            setPhotos]            = useState<Photo[]>([]);
  const [locations,         setLocations]         = useState<CaptureLocation[]>([]);
  const [imageStreams,      setImageStreams]      = useState<ImageStream[]>([]);
  const [importQueue,       setImportQueue]       = useState<ImportQueueItem[]>([]);
  const [operatingDate,     setOperatingDateRaw]  = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [selectedSessionId, setSession]           = useState<string>('');
  const [selectedPhotoId,   setPhoto]             = useState<string>('');
  const [selectedPhotoIds,  setSelectedPhotoIds]  = useState<string[]>([]);
  const [activeTab,         setTabState]          = useState<TabKey>('gallery');
  const [selectedHour,      setHourState]         = useState<string>('14:00');
  const [selectedLocationId, setLocationIdState]  = useState<string>('');
  // hours is derived from allPhotos + operatingDate + selected location — no separate fetch needed when filters change
  const hours = useMemo(() => {
    if (!selectedLocationId) return buildHourlyImportBuckets(allPhotos, operatingDate);

    const visibleSessionIds = new Set(
      sessions
        .filter(session => session.captureLocationId === selectedLocationId)
        .map(session => session.id),
    );
    const visiblePhotos = allPhotos.filter(photo => visibleSessionIds.has(photo.sessionId));
    return buildHourlyImportBuckets(visiblePhotos, operatingDate);
  }, [allPhotos, operatingDate, selectedLocationId, sessions]);
  const [filter,            setFilterState]       = useState<FilterKey>('All');
  const [watchedFolderSettings, setWatchedFolderSettingsState] = useState<WatchedFolderSettings>(DEFAULT_WATCHED_FOLDER_SETTINGS);
  const [watcherRuntime, setWatcherRuntime] = useState<WatcherRuntimeState>({
    status: isTauriRuntime() ? 'off' : 'desktop-only',
  });
  const [isLoading,         setIsLoading]         = useState(true);
  const streamWatcherConfig = useMemo(() => JSON.stringify(imageStreams.map(stream => ({
    id: stream.id,
    type: stream.type,
    enabled: stream.enabled,
    watchPath: stream.watchPath,
    captureLocationId: stream.captureLocationId,
    autoEnhanceEnabled: stream.autoEnhanceEnabled,
    fileRenamingEnabled: stream.fileRenamingEnabled,
    fileNamingFields: stream.fileNamingFields,
    fileNamingSeparator: stream.fileNamingSeparator,
    fileNamingExtension: stream.fileNamingExtension,
  }))), [imageStreams]);
  const imageStreamsRef = useRef<ImageStream[]>([]);

  useEffect(() => {
    imageStreamsRef.current = imageStreams;
  }, [imageStreams]);

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
        setImageStreams(await repoGetImageStreams());
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
    setLocations(await getLocations());
    setImageStreams(await repoGetImageStreams());
    setImportQueue(await getImportQueue());
  }, [selectedSessionId]);

  useEffect(() => {
    if (isLoading) return undefined;

    if (!isTauriRuntime()) {
      setWatcherRuntime({ status: 'desktop-only' });
      return undefined;
    }

    void startImageStreamWatchers({
      streams: imageStreamsRef.current,
      settleDelayMs: watchedFolderSettings.fileSettleDelayMs,
      sessionId: selectedSessionId,
      onStatus: setWatcherRuntime,
      onStreamStatus: (streamId, state) => {
        const nextStatus = state.status === 'importing'
          ? 'receiving'
          : state.status === 'watching'
            ? 'watching'
            : state.status === 'error'
              ? 'error'
              : undefined;
        setImageStreams(current => current.map(stream => (
          stream.id === streamId
            ? {
              ...stream,
              status: nextStatus ?? stream.status,
              lastDetectedFilename: state.lastDetected ?? stream.lastDetectedFilename,
              lastActivityAt: state.lastDetected || state.lastImport || state.error ? new Date().toISOString() : stream.lastActivityAt,
            }
            : stream
        )));
      },
      onImported: async () => {
        await refreshData(selectedSessionId);
      },
    });

    return () => {
      void stopWatchedFolder();
    };
  }, [isLoading, refreshData, selectedSessionId, streamWatcherConfig, watchedFolderSettings.fileSettleDelayMs]);

  const selectSession = useCallback((id: string, preferredPhotoId?: string) => {
    void (async () => {
      setSession(id);
      await setSelectedSessionId(id);
      // Only load the new session's photos — sessions/locations/streams/queue are unchanged.
      const raw = await getPhotosBySessionId(id);
      const resolved = await resolvePhotoSources(raw);
      const preferredPhoto = preferredPhotoId
        ? resolved.find(photo => photo.id === preferredPhotoId)
        : undefined;
      const photoId = preferredPhoto?.id ?? resolved[0]?.id ?? '';
      setPhoto(photoId);
      setSelectedPhotoIds(photoId ? [photoId] : []);
      await setSelectedPhotoId(photoId);
      setPhotos(resolved);
    })();
  }, []);

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
    if (selectedHour === h) return;
    setHourState(h);
    void setSelectedHour(h);
  }, [selectedHour]);

  const setLocationId = useCallback((id: string) => {
    setLocationIdState(id);
  }, []);

  const setOperatingDate = useCallback((d: Date) => {
    const todayMidnight = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
    // Clamp to today — future dates have no import data
    setOperatingDateRaw(d > todayMidnight ? todayMidnight : d);
  }, []);

  const setFilter = useCallback((f: FilterKey) => {
    setFilterState(f);
  }, []);

  const toggleFavorite = useCallback((photoId: string) => {
    void (async () => {
      const target = allPhotos.find(photo => photo.id === photoId);
      if (!target) return;
      const next = { ...target, isFavorite: !target.isFavorite };
      // Optimistic in-place update — no full reload needed for a single metadata field change.
      setAllPhotos(current => current.map(p => p.id === photoId ? next : p));
      setPhotos(current => current.map(p => p.id === photoId ? next : p));
      await repoUpdatePhoto(photoId, { isFavorite: !target.isFavorite });
    })();
  }, [allPhotos]);

  const toggleFlag = useCallback((photoId: string) => {
    void (async () => {
      const target = allPhotos.find(photo => photo.id === photoId);
      if (!target) return;
      const nextFlag: Photo['flag'] = target.flag === 'flagged' ? 'none' : 'flagged';
      const next = { ...target, flag: nextFlag };
      // Optimistic in-place update — no full reload needed for a single metadata field change.
      setAllPhotos(current => current.map(p => p.id === photoId ? next : p));
      setPhotos(current => current.map(p => p.id === photoId ? next : p));
      await repoUpdatePhoto(photoId, { flag: nextFlag });
    })();
  }, [allPhotos]);

  const importPhotosToActiveSession = useCallback(async (files: File[]) => {
    if (!selectedSessionId || files.length === 0) return;
    const imported = await repoImportPhotos(selectedSessionId, files);
    const firstImported = imported[0];
    const nextSessionId = firstImported?.sessionId ?? selectedSessionId;
    if (nextSessionId !== selectedSessionId) {
      setSession(nextSessionId);
      await setSelectedSessionId(nextSessionId);
    }
    await refreshData(nextSessionId);
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

  const removeImportQueueItem = useCallback((id: string) => {
    void (async () => {
      await repoRemoveImportQueueItem(id);
      setImportQueue(q => q.filter(item => item.id !== id));
    })();
  }, []);

  const clearImportQueue = useCallback(() => {
    void (async () => {
      await repoClearImportQueue();
      setImportQueue([]);
    })();
  }, []);

  const refreshStreamsAndLocations = useCallback(async () => {
    setImageStreams(await repoGetImageStreams());
    setLocations(await getLocations());
  }, []);

  const createImageStream = useCallback(async (input: { name: string; code?: string; watchPath?: string | null; enabled?: boolean; processingPreset?: string | null; printerName?: string | null; autoPrintEnabled?: boolean; autoPrintItems?: AutoPrintItem[]; autoEnhanceEnabled?: boolean; enhanceBrightness?: number; enhanceContrast?: number; enhanceSaturation?: number; enhanceSharpen?: number; fileRenamingEnabled?: boolean; fileNamingFields?: FileNamingField[]; fileNamingSeparator?: FileNamingSeparator; fileNamingExtension?: FileNamingExtension }) => {
    await repoCreateImageStream({
      name: input.name.trim() || `New Stream ${imageStreams.length + 1}`,
      code: input.code,
      watchPath: input.watchPath,
      enabled: input.enabled,
      processingPreset: input.processingPreset,
      printerName: input.printerName,
      autoPrintEnabled: input.autoPrintEnabled,
      autoPrintItems: input.autoPrintItems,
      autoEnhanceEnabled: input.autoEnhanceEnabled,
      enhanceBrightness: input.enhanceBrightness,
      enhanceContrast: input.enhanceContrast,
      enhanceSaturation: input.enhanceSaturation,
      enhanceSharpen: input.enhanceSharpen,
      fileRenamingEnabled: input.fileRenamingEnabled,
      fileNamingFields: input.fileNamingFields,
      fileNamingSeparator: input.fileNamingSeparator,
      fileNamingExtension: input.fileNamingExtension,
    });
    await refreshStreamsAndLocations();
  }, [imageStreams.length, refreshStreamsAndLocations]);

  const updateImageStream = useCallback(async (id: string, changes: Partial<ImageStream>) => {
    await repoUpdateImageStream(id, changes);
    await refreshStreamsAndLocations();
  }, [refreshStreamsAndLocations]);

  const deleteImageStream = useCallback(async (id: string) => {
    await repoDeleteImageStream(id);
    await refreshStreamsAndLocations();
  }, [refreshStreamsAndLocations]);

  const chooseImageStreamFolder = useCallback(async (id: string) => {
    if (!isTauriRuntime()) return;

    try {
      const dialog = await import('@tauri-apps/plugin-dialog');
      const selected = await dialog.open({
        directory: true,
        multiple: false,
      });

      if (typeof selected !== 'string') return;
      await repoUpdateImageStream(id, { watchPath: selected, status: 'idle' });
      await refreshStreamsAndLocations();
    } catch (error) {
      await repoUpdateImageStream(id, {
        status: 'error',
        lastActivityAt: new Date().toISOString(),
      });
      setWatcherRuntime({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not choose stream folder.',
      });
      await refreshStreamsAndLocations();
    }
  }, [refreshStreamsAndLocations]);

  const clearImageStreamFolder = useCallback(async (id: string) => {
    await repoUpdateImageStream(id, { watchPath: null, enabled: false, status: 'disabled' });
    await refreshStreamsAndLocations();
  }, [refreshStreamsAndLocations]);

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

  const deleteSessionFromGallery = useCallback(async (sessionId: string) => {
    const remainingSessions = sessions.filter(session => session.id !== sessionId);
    const nextSessionId = selectedSessionId === sessionId
      ? remainingSessions[0]?.id ?? ''
      : selectedSessionId;

    await repoDeleteSession(sessionId);

    const firstPhoto = nextSessionId ? (await getPhotosBySessionId(nextSessionId))[0] : undefined;
    const nextPhotoId = firstPhoto?.id ?? '';
    setSession(nextSessionId);
    setPhoto(nextPhotoId);
    setSelectedPhotoIds(nextPhotoId ? [nextPhotoId] : []);
    await setSelectedSessionId(nextSessionId);
    await setSelectedPhotoId(nextPhotoId);
    await refreshData(nextSessionId);
  }, [refreshData, selectedSessionId, sessions]);

  const updateWatchedFolderSettings = useCallback(async (changes: Partial<WatchedFolderSettings>) => {
    const next = { ...watchedFolderSettings, ...changes };
    setWatchedFolderSettingsState(next);
    await repoSetWatchedFolderSettings(next);
    const primaryStream = imageStreams[0];
    if (primaryStream) {
      await repoUpdateImageStream(primaryStream.id, {
        enabled: next.watchEnabled,
        watchPath: next.watchedImportFolder,
        status: next.watchEnabled ? (next.watchedImportFolder ? 'watching' : 'idle') : 'disabled',
      });
      await refreshStreamsAndLocations();
    }
  }, [imageStreams, refreshStreamsAndLocations, watchedFolderSettings]);

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
      const primaryStream = imageStreams[0];
      if (primaryStream) {
        await repoUpdateImageStream(primaryStream.id, { watchPath: selected, status: primaryStream.enabled ? 'watching' : 'idle' });
        await refreshStreamsAndLocations();
      }
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
  }, [imageStreams, refreshStreamsAndLocations, updateWatchedFolderSettings, watchedFolderSettings.watchEnabled]);

  const refreshPhotoInPlace = useCallback(async (photoId: string): Promise<void> => {
    const raw = await getPhotoById(photoId);
    if (!raw) return;
    const [resolved] = await resolvePhotoSources([raw]);
    if (!resolved) return;
    setAllPhotos(current => current.map(p => p.id === photoId ? resolved : p));
    setPhotos(current => current.map(p => p.id === photoId ? resolved : p));
  }, []);

  const getPhotoVersions = useCallback(async (photoId: string): Promise<PhotoVersion[]> => {
    return repoGetPhotoVersions(photoId);
  }, []);

  const switchPhotoVersion = useCallback(async (photoId: string, kind: PhotoVersionKind): Promise<void> => {
    await repoSetActiveVersion(photoId, kind);
    // Optimistic in-place update — fetch version list to get the right displayUrl.
    const versions = await repoGetPhotoVersions(photoId);
    const target = versions.find(v => v.kind === kind);
    if (!target) return;
    setAllPhotos(current => current.map(p =>
      p.id === photoId
        ? { ...p, displayUrl: target.displayUrl, thumbnailUrl: target.displayUrl, activeVersionKind: kind }
        : p,
    ));
    setPhotos(current => current.map(p =>
      p.id === photoId
        ? { ...p, displayUrl: target.displayUrl, thumbnailUrl: target.displayUrl, activeVersionKind: kind }
        : p,
    ));
  }, []);

  const resetDemo = useCallback(() => {
    void (async () => {
      const freshSessions = await resetDemoData();
      await applyFreshDemoState(freshSessions, {
        setSessions,
        setSession,
        setPhoto,
        setSelectedPhotoIds,
        setPhotos,
        setAllPhotos,
        setLocations,
        setImageStreams,
        setImportQueue,
        setWatchedFolderSettingsState,
        setTabState,
        setHourState,
        setFilterState,
      });
    })();
  }, []);

  const value: AppContextValue = {
    sessions, allPhotos, photos, locations, imageStreams, hours, importQueue,
    selectedSessionId, selectedPhotoId, selectedPhotoIds, activeTab, selectedHour, selectedLocationId, operatingDate, filter,
    watchedFolderSettings, watcherRuntime, isLoading,
    selectSession, selectPhoto, togglePhotoSelection, selectPhotoRange, clearPhotoSelection, deleteSelectedPhotos, deleteSessionFromGallery, setTab, setHour, setLocationId, setOperatingDate, setFilter,
    toggleFavorite, toggleFlag, importPhotosToActiveSession, removeImportQueueItem, clearCompletedImports, clearImportQueue,
    chooseWatchedFolder, updateWatchedFolderSettings,
    refreshPhotoInPlace, getPhotoVersions, switchPhotoVersion,
    createImageStream, updateImageStream, deleteImageStream, chooseImageStreamFolder, clearImageStreamFolder,
    resetDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
