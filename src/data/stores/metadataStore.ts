import type {
  CaptureLocation,
  HourBucket,
  ImageStream,
  ImportQueueItem,
  Photo,
  PhotoVersion,
  PhotoVersionKind,
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
    changes: Partial<Pick<Photo, 'flag' | 'isFavorite' | 'isHidden' | 'operatorNotes' | 'processingStatus' | 'afterImageUrl' | 'displayUrl' | 'thumbnailUrl' | 'activeVersionKind' | 'autoEnhanceEnabled'>>,
  ): Promise<Photo | undefined>;
  addPhotoToSession(sessionId: string, photo: Photo): Promise<Photo>;
  deletePhotos(photoIds: string[]): Promise<void>;
  addPhotoVersion(version: PhotoVersion): Promise<void>;
  getPhotoVersions(photoId: string): Promise<PhotoVersion[]>;
  setActiveVersion(photoId: string, kind: PhotoVersionKind): Promise<void>;
  deletePhotoVersionsByPhotoId(photoId: string): Promise<void>;
  getImportQueue(): Promise<ImportQueueItem[]>;
  addImportQueueItem(item: ImportQueueItem): Promise<void>;
  updateImportQueueItem(itemId: string, changes: Partial<ImportQueueItem>): Promise<void>;
  removeImportQueueItem(id: string): Promise<void>;
  clearCompletedImports(): Promise<void>;
  clearImportQueue(): Promise<void>;
  getLocations(): Promise<CaptureLocation[]>;
  getImageStreams(): Promise<ImageStream[]>;
  getImageStreamById(id: string): Promise<ImageStream | undefined>;
  addImageStream(stream: ImageStream): Promise<ImageStream>;
  updateImageStream(id: string, changes: Partial<ImageStream>): Promise<ImageStream | undefined>;
  deleteImageStream(id: string): Promise<void>;
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
