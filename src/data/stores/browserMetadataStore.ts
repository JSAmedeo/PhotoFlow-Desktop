import {
  storeClearAll,
  storeGet,
  storeSet,
  STORE_KEYS,
} from '../localStore';
import type {
  CaptureLocation,
  HourBucket,
  ImageStream,
  ImportQueueItem,
  Photo,
  Session,
  TabKey,
  WatchedFolderSettings,
} from '../models';
import {
  DEFAULT_SELECTED_HOUR,
  DEFAULT_SELECTED_SESSION_ID,
  SEED_HOURS,
  SEED_LOCATIONS,
  SEED_PHOTOS,
  SEED_SESSIONS,
} from '../seedData';
import { comparePhotosForDisplay } from '../photoSorting';
import type { MetadataStore } from './metadataStore';

const DEFAULT_WATCHED_FOLDER_SETTINGS: WatchedFolderSettings = {
  watchEnabled: false,
  watchedImportFolder: null,
  fileSettleDelayMs: 2000,
  defaultCaptureLocationId: 'loc-2',
  defaultSessionAssignmentMode: 'active-session',
};

const LEGACY_DEFAULT_STREAM_IDS = new Set([
  'stream-giraffes',
  'stream-main-gate',
  'stream-pandas',
  'stream-statue',
  'stream-lion-cubs',
  'stream-sea-lions',
  'stream-carousel',
]);

function seedStore(): void {
  storeSet(STORE_KEYS.sessions,          SEED_SESSIONS);
  storeSet(STORE_KEYS.photos,            SEED_PHOTOS);
  storeSet(STORE_KEYS.locations,         SEED_LOCATIONS);
  storeSet(STORE_KEYS.imageStreams,      []);
  storeSet(STORE_KEYS.hours,             SEED_HOURS);
  storeSet(STORE_KEYS.importQueue,       []);
  storeSet(STORE_KEYS.selectedSessionId, DEFAULT_SELECTED_SESSION_ID);
  storeSet(STORE_KEYS.selectedPhotoId,   `${DEFAULT_SELECTED_SESSION_ID}-p1`);
  storeSet(STORE_KEYS.activeTab,         'gallery');
  storeSet(STORE_KEYS.selectedHour,      DEFAULT_SELECTED_HOUR);
}

function streamsToLocations(streams: ImageStream[]): CaptureLocation[] {
  return streams.map(stream => ({
    id: stream.captureLocationId ?? stream.id,
    name: stream.name,
    code: stream.code ?? stream.slug.toUpperCase(),
    isActive: stream.enabled || stream.status !== 'disabled',
  }));
}

function removeBlankLegacySeedStreams(streams: ImageStream[]): ImageStream[] {
  return streams.filter(stream => !(
    (LEGACY_DEFAULT_STREAM_IDS.has(stream.id) || /^New Stream( \d+)?$/i.test(stream.name)) &&
    !stream.watchPath &&
    stream.totalDetected === 0 &&
    stream.totalImported === 0 &&
    stream.totalSkipped === 0 &&
    stream.totalFailed === 0
  ));
}

export const browserMetadataStore: MetadataStore = {
  async initialize() {
    if (storeGet(STORE_KEYS.sessions) === null) seedStore();
  },

  async getSessions() {
    return storeGet<Session[]>(STORE_KEYS.sessions) ?? [];
  },

  async getSessionById(id: string) {
    return (await this.getSessions()).find(session => session.id === id);
  },

  async getSessionByCode(sessionCode: string) {
    const normalized = sessionCode.toUpperCase();
    return (await this.getSessions()).find(session => session.sessionCode.toUpperCase() === normalized);
  },

  async addSession(session) {
    const sessions = await this.getSessions();
    const existing = sessions.find(candidate => (
      candidate.id === session.id ||
      candidate.sessionCode.toUpperCase() === session.sessionCode.toUpperCase()
    ));
    if (existing) return existing;

    storeSet(STORE_KEYS.sessions, [...sessions, session]);
    return session;
  },

  async updateSessionMetadata(id, changes) {
    const sessions = await this.getSessions();
    const idx = sessions.findIndex(session => session.id === id);
    if (idx === -1) return undefined;

    sessions[idx] = { ...sessions[idx], ...changes, updatedAt: new Date().toISOString() };
    storeSet(STORE_KEYS.sessions, sessions);
    return sessions[idx];
  },

  async deleteSession(sessionId) {
    const sessions = await this.getSessions();
    const photos = await this.getPhotos();
    const queue = await this.getImportQueue();

    storeSet(STORE_KEYS.sessions, sessions.filter(session => session.id !== sessionId));
    storeSet(STORE_KEYS.photos, photos.filter(photo => photo.sessionId !== sessionId));
    storeSet(STORE_KEYS.importQueue, queue.filter(item => item.sessionId !== sessionId));
  },

  async getPhotos() {
    return [...(storeGet<Photo[]>(STORE_KEYS.photos) ?? [])].sort(comparePhotosForDisplay);
  },

  async getPhotosBySessionId(sessionId: string) {
    return (await this.getPhotos()).filter(photo => photo.sessionId === sessionId);
  },

  async getPhotoById(id: string) {
    return (await this.getPhotos()).find(photo => photo.id === id);
  },

  async updatePhotoMetadata(id, changes) {
    const photos = await this.getPhotos();
    const idx = photos.findIndex(photo => photo.id === id);
    if (idx === -1) return undefined;

    photos[idx] = { ...photos[idx], ...changes };
    storeSet(STORE_KEYS.photos, photos);
    return photos[idx];
  },

  async addPhotoToSession(sessionId, photo) {
    const sessions = await this.getSessions();
    const photos = await this.getPhotos();
    const idx = sessions.findIndex(session => session.id === sessionId);
    if (idx === -1) throw new Error('No active session found for import.');

    const nextPhotos = [...photos, photo];
    const nextSessions = sessions.map((session, i) => (
      i === idx
        ? { ...session, photoCount: session.photoCount + 1, updatedAt: new Date().toISOString() }
        : session
    ));

    const wrotePhotos = storeSet(STORE_KEYS.photos, nextPhotos);
    const wroteSessions = wrotePhotos && storeSet(STORE_KEYS.sessions, nextSessions);
    if (!wrotePhotos || !wroteSessions) {
      storeSet(STORE_KEYS.photos, photos);
      storeSet(STORE_KEYS.sessions, sessions);
      throw new Error('Browser storage is full. The imported photo was not saved.');
    }

    return photo;
  },

  async deletePhotos(photoIds) {
    const ids = new Set(photoIds);
    if (ids.size === 0) return;

    const photos = await this.getPhotos();
    const sessions = await this.getSessions();
    const deletedBySession = new Map<string, number>();

    for (const photo of photos) {
      if (!ids.has(photo.id)) continue;
      deletedBySession.set(photo.sessionId, (deletedBySession.get(photo.sessionId) ?? 0) + 1);
    }

    storeSet(STORE_KEYS.photos, photos.filter(photo => !ids.has(photo.id)));
    storeSet(STORE_KEYS.sessions, sessions.map(session => {
      const deletedCount = deletedBySession.get(session.id) ?? 0;
      if (deletedCount === 0) return session;
      return {
        ...session,
        photoCount: Math.max(0, session.photoCount - deletedCount),
        updatedAt: new Date().toISOString(),
      };
    }));
  },

  async getImportQueue() {
    return storeGet<ImportQueueItem[]>(STORE_KEYS.importQueue) ?? [];
  },

  async addImportQueueItem(item) {
    storeSet(STORE_KEYS.importQueue, [...await this.getImportQueue(), item]);
  },

  async updateImportQueueItem(itemId, changes) {
    const queue = (await this.getImportQueue()).map(item => (
      item.id === itemId ? { ...item, ...changes } : item
    ));
    storeSet(STORE_KEYS.importQueue, queue);
  },

  async removeImportQueueItem(id: string) {
    const queue = await this.getImportQueue();
    storeSet(STORE_KEYS.importQueue, queue.filter(item => item.id !== id));
  },

  async clearCompletedImports() {
    const active = (await this.getImportQueue()).filter(item => item.status === 'queued' || item.status === 'stabilizing' || item.status === 'importing');
    storeSet(STORE_KEYS.importQueue, active);
  },

  async clearImportQueue() {
    storeSet(STORE_KEYS.importQueue, []);
  },

  async getLocations() {
    const streams = await this.getImageStreams();
    return streams.length > 0 ? streamsToLocations(streams) : (storeGet<CaptureLocation[]>(STORE_KEYS.locations) ?? SEED_LOCATIONS);
  },

  async getImageStreams() {
    const streams = storeGet<ImageStream[]>(STORE_KEYS.imageStreams) ?? [];
    const cleaned = removeBlankLegacySeedStreams(streams);
    if (cleaned.length !== streams.length) storeSet(STORE_KEYS.imageStreams, cleaned);
    return cleaned;
  },

  async getImageStreamById(id) {
    return (await this.getImageStreams()).find(stream => stream.id === id);
  },

  async addImageStream(stream) {
    const streams = await this.getImageStreams();
    const existing = streams.find(candidate => candidate.id === stream.id || candidate.slug === stream.slug);
    if (existing) return existing;
    storeSet(STORE_KEYS.imageStreams, [...streams, stream]);
    return stream;
  },

  async updateImageStream(id, changes) {
    const streams = await this.getImageStreams();
    const idx = streams.findIndex(stream => stream.id === id);
    if (idx === -1) return undefined;

    const updated: ImageStream = { ...streams[idx], ...changes, updatedAt: new Date().toISOString() };
    streams[idx] = updated;
    storeSet(STORE_KEYS.imageStreams, streams);
    return updated;
  },

  async deleteImageStream(id) {
    storeSet(STORE_KEYS.imageStreams, (await this.getImageStreams()).filter(stream => stream.id !== id));
  },

  async getHours() {
    return storeGet<HourBucket[]>(STORE_KEYS.hours) ?? SEED_HOURS;
  },

  async getSelectedSessionId() {
    return storeGet<string>(STORE_KEYS.selectedSessionId) ?? DEFAULT_SELECTED_SESSION_ID;
  },

  async setSelectedSessionId(id) {
    storeSet(STORE_KEYS.selectedSessionId, id);
  },

  async getSelectedPhotoId() {
    return storeGet<string>(STORE_KEYS.selectedPhotoId) ?? `${DEFAULT_SELECTED_SESSION_ID}-p1`;
  },

  async setSelectedPhotoId(id) {
    storeSet(STORE_KEYS.selectedPhotoId, id);
  },

  async getActiveTab() {
    return storeGet<TabKey>(STORE_KEYS.activeTab) ?? 'gallery';
  },

  async setActiveTab(tab) {
    storeSet(STORE_KEYS.activeTab, tab);
  },

  async getSelectedHour() {
    return storeGet<string>(STORE_KEYS.selectedHour) ?? DEFAULT_SELECTED_HOUR;
  },

  async setSelectedHour(h) {
    storeSet(STORE_KEYS.selectedHour, h);
  },

  async getWatchedFolderSettings() {
    return storeGet<WatchedFolderSettings>(STORE_KEYS.watchedFolderSettings) ?? DEFAULT_WATCHED_FOLDER_SETTINGS;
  },

  async setWatchedFolderSettings(settings) {
    storeSet(STORE_KEYS.watchedFolderSettings, settings);
  },

  async resetDemoData() {
    storeClearAll();
    seedStore();
    return this.getSessions();
  },

  // Photo versions — no-op in browser mode; enhancement requires Tauri.
  async addPhotoVersion() { /* no-op */ },
  async getPhotoVersions() { return []; },
  async setActiveVersion() { /* no-op */ },
  async deletePhotoVersionsByPhotoId() { /* no-op */ },
};
