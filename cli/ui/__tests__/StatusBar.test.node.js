import { describe, it, expect } from 'vitest';
import { shortPath } from '../StatusBar.js';

describe('shortPath', () => {
  it('returns . for empty', () => {
    expect(shortPath('')).toBe('.');
    expect(shortPath(null)).toBe('.');
  });

  it('shortens under home to ~', () => {
    const home = process.env.HOME || '/home/user';
    expect(shortPath(home)).toBe('~');
    expect(shortPath(`${home}/projects/deepiri`)).toBe('~/projects/deepiri');
  });

  it('ellipsis long deep paths', () => {
    const long = '/var/very/long/path/that/keeps/going/into/nested/dirs/project';
    const s = shortPath(long, 28);
    expect(s.length).toBeLessThanOrEqual(28);
    expect(s).toContain('…');
    expect(s.endsWith('project') || s.includes('/project')).toBe(true);
  });
});
