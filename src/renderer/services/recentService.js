import { getJSON, setItem, removeItem } from '../utils/storage';
import { STORAGE_KEYS, MAX_RECENT_FOLDERS, MAX_RECENT_FILES } from '../constants/storageKeys';

export const recentService = {
  getRecentFolders() {
    try {
      const raw = getJSON(STORAGE_KEYS.RECENT_FOLDERS);
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  },

  addRecentFolder(path) {
    const list = this.getRecentFolders().filter((p) => p !== path);
    list.unshift(path);
    setItem(STORAGE_KEYS.RECENT_FOLDERS, list.slice(0, MAX_RECENT_FOLDERS));
  },

  getRecentFiles() {
    try {
      const raw = getJSON(STORAGE_KEYS.RECENT_FILES);
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  },

  addRecentFile(path, name) {
    const list = this.getRecentFiles().filter((f) => f.path !== path);
    list.unshift({ path, name, openedAt: Date.now() });
    setItem(STORAGE_KEYS.RECENT_FILES, list.slice(0, MAX_RECENT_FILES));
  },

  clearRecent() {
    removeItem(STORAGE_KEYS.RECENT_FOLDERS);
    removeItem(STORAGE_KEYS.RECENT_FILES);
  }
};

if (typeof window !== 'undefined') {
  window.recentService = recentService;
}
