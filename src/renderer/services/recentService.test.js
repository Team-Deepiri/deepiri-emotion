import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recentService } from './recentService';

describe('recentService', () => {
  const storage = {};
  const localStorageMock = {
    getItem: vi.fn((key) => storage[key] ?? null),
    setItem: vi.fn((key, value) => { storage[key] = value; }),
    removeItem: vi.fn((key) => { delete storage[key]; }),
    clear: vi.fn(() => { Object.keys(storage).forEach((k) => delete storage[k]); })
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    Object.keys(storage).forEach((k) => delete storage[k]);
    localStorageMock.setItem.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getRecentFolders', () => {
    it('returns empty array when nothing stored', () => {
      expect(recentService.getRecentFolders()).toEqual([]);
    });

    it('returns parsed folders when stored', () => {
      storage['deepiri_recent_folders'] = JSON.stringify(['/a', '/b']);
      expect(recentService.getRecentFolders()).toEqual(['/a', '/b']);
    });

    it('returns empty array on invalid JSON', () => {
      storage['deepiri_recent_folders'] = 'not json';
      expect(recentService.getRecentFolders()).toEqual([]);
    });
  });

  describe('addRecentFolder', () => {
    it('adds folder to list', () => {
      recentService.addRecentFolder('/projects/foo');
      expect(recentService.getRecentFolders()).toEqual(['/projects/foo']);
    });

    it('moves existing folder to front', () => {
      recentService.addRecentFolder('/a');
      recentService.addRecentFolder('/b');
      recentService.addRecentFolder('/a');
      expect(recentService.getRecentFolders()).toEqual(['/a', '/b']);
    });

    it('limits to 10 folders', () => {
      for (let i = 0; i < 12; i++) recentService.addRecentFolder(`/path/${i}`);
      expect(recentService.getRecentFolders().length).toBe(10);
      expect(recentService.getRecentFolders()[0]).toBe('/path/11');
    });
  });

  describe('getRecentFiles', () => {
    it('returns empty array when nothing stored', () => {
      expect(recentService.getRecentFiles()).toEqual([]);
    });

    it('returns parsed files when stored', () => {
      storage['deepiri_recent_files'] = JSON.stringify([{ path: '/f.js', name: 'f.js' }]);
      expect(recentService.getRecentFiles()).toEqual([{ path: '/f.js', name: 'f.js' }]);
    });
  });

  describe('addRecentFile', () => {
    it('adds file to list', () => {
      recentService.addRecentFile('/src/app.js', 'app.js');
      const files = recentService.getRecentFiles();
      expect(files.length).toBe(1);
      expect(files[0].path).toBe('/src/app.js');
      expect(files[0].name).toBe('app.js');
      expect(files[0].openedAt).toBeDefined();
    });

    it('moves existing file to front', () => {
      recentService.addRecentFile('/a.js', 'a.js');
      recentService.addRecentFile('/b.js', 'b.js');
      recentService.addRecentFile('/a.js', 'a.js');
      expect(recentService.getRecentFiles().map((f) => f.path)).toEqual(['/a.js', '/b.js']);
    });

    it('limits to 20 files', () => {
      for (let i = 0; i < 22; i++) recentService.addRecentFile(`/f${i}.js`, `f${i}.js`);
      expect(recentService.getRecentFiles().length).toBe(20);
    });
  });

  describe('clearRecent', () => {
    it('removes all recent data', () => {
      recentService.addRecentFolder('/x');
      recentService.addRecentFile('/y.js', 'y.js');
      recentService.clearRecent();
      expect(recentService.getRecentFolders()).toEqual([]);
      expect(recentService.getRecentFiles()).toEqual([]);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deepiri_recent_folders');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deepiri_recent_files');
    });
  });
});
