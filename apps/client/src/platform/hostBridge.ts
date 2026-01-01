import Dexie, { type Table } from 'dexie';
import type { DisplaySettings, FsrsCardRecord, SubjectId } from '@pkg/contracts';
import type { QuestionSubmission } from '@pkg/learning-core';

export interface OfflineAttemptQueueItem {
  id?: number;
  questionId: string;
  familyId: string;
  subject: SubjectId;
  knowledgeNode: string;
  isCorrect: boolean;
  isSkipped: boolean;
  createdAtIso: string;
  synced: boolean;
  submission?: QuestionSubmission;
  packId?: string;
  coursePackVersion?: string;
  nodeAttemptKey?: string;
  syncUserId?: string;
}

class ClientOfflineDb extends Dexie {
  fsrsCards!: Table<FsrsCardRecord, string>;
  offlineAttempts!: Table<OfflineAttemptQueueItem, number>;

  constructor() {
    super('BeyondLightConeOfflineDB');
    this.version(1).stores({
      fsrsCards: 'familyId, subject, dueIso',
      offlineAttempts: '++id, synced, subject, createdAtIso',
    });
  }
}

export const offlineDb = new ClientOfflineDb();

const SESSION_STORAGE_KEY = 'blc_auth_token_v1';

export function isTauriHost(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function readStoredSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredSessionToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(SESSION_STORAGE_KEY, token);
    else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
  }
}

export async function clearAllPrivateSessionCache(): Promise<void> {
  writeStoredSessionToken(null);
  try {
    await offlineDb.fsrsCards.clear();
  } catch {
  }
}

export async function applyHostDisplaySettings(settings: DisplaySettings): Promise<{ appliedFullscreen: boolean }> {
  if (isTauriHost()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.setFullscreen(settings.fullscreen);
      return { appliedFullscreen: settings.fullscreen };
    } catch {
      return { appliedFullscreen: Boolean(document.fullscreenElement) };
    }
  }

  if (typeof document === 'undefined') return { appliedFullscreen: false };
  try {
    if (settings.fullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    } else if (!settings.fullscreen && document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch {
  }
  return { appliedFullscreen: Boolean(document.fullscreenElement) };
}
