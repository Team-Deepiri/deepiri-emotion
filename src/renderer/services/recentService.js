const STORAGE_KEY = 'deepiri_recent';
const MAX_RECENT_FOLDERS = 10;
const MAX_RECENT_FILES = 20;

export const recentService = {
  getRecentFolders() {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_folders`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addRecentFolder(path) {
    const list = this.getRecentFolders().filter((p) => p !== path);
    list.unshift(path);
    localStorage.setItem(`${STORAGE_KEY}_folders`, JSON.stringify(list.slice(0, MAX_RECENT_FOLDERS)));
  },

  getRecentFiles() {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_files`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addRecentFile(path, name) {
    const list = this.getRecentFiles().filter((f) => f.path !== path);
    list.unshift({ path, name, openedAt: Date.now() });
    localStorage.setItem(`${STORAGE_KEY}_files`, JSON.stringify(list.slice(0, MAX_RECENT_FILES)));
  },

  clearRecent() {
    localStorage.removeItem(`${STORAGE_KEY}_folders`);
    localStorage.removeItem(`${STORAGE_KEY}_files`);
  }
};

if (typeof window !== 'undefined') {
  window.recentService = recentService;
}
