import type {
  CaptureLocation,
  HourBucket,
  ImportQueueItem,
  Photo,
  Session,
  TabKey,
  WatchedFolderSettings,
} from '../models';

export interface MetadataStore {
  initialize(): Promise<void>;
  getSessions(): Promise<Session[]>;
  getSessionById(id: string): Promise<Session | undefined>;
  getSessionByCode(sessionCode: string): Promise<Session | undefined>;
  addSession(session: Session): Promise<Session>;
  updateSessionMetadata(
    id: string,
    changes: Partial<Pick<Session, 'status' | 'notes' | 'linkedSessionIds' | 'updatedAt'>>,
  ): Promise<Session | undefined>;
  deleteSession(sessionId: string): Promise<void>;
  getPhotos(): Promise<Photo[]>;
  getPhotosBySessionId(sessionId: string): Promise<Photo[]>;
  getPhotoById(id: string): Promise<Photo | undefined>;
  updatePhotoMetadata(
    id: string,
    changes: Partial<Pick<Photo, 'flag' | 'isFavorite' | 'isHidden' | 'operatorNotes' | 'processingStatus'>>,
  ): Promise<Photo | undefined>;
  addPhotoToSession(sessionId: string, photo: Photo): Promise<Photo>;
  deletePhotos(photoIds: string[]): Promise<void>;
  getImportQueue(): Promise<ImportQueueItem[]>;
  addImportQueueItem(item: ImportQueueItem): Promise<void>;
  updateImportQueueItem(itemId: string, changes: Partial<ImportQueueItem>): Promise<void>;
  clearCompletedImports(): Promise<void>;
  clearImportQueue(): Promise<void>;
  getLocations(): Promise<CaptureLocation[]>;
  getHours(): Promise<HourBucket[]>;
  getSelectedSessionId(): Promise<string>;
  setSelectedSessionId(id: string): Promise<void>;
  getSelectedPhotoId(): Promise<string>;
  setSelectedPhotoId(id: string): Promise<void>;
  getActiveTab(): Promise<TabKey>;
  setActiveTab(tab: TabKey): Promise<void>;
  getSelectedHour(): Promise<string>;
  setSelectedHour(h: string): Promise<void>;
  getWatchedFolderSettings(): Promise<WatchedFolderSettings>;
  setWatchedFolderSettings(settings: WatchedFolderSettings): Promise<void>;
  resetDemoData(): Promise<Session[]>;
}
