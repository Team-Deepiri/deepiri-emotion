import { describe, it, expect } from 'vitest';
import { getLanguage } from './MonacoEditor';

describe('getLanguage', () => {
  it('returns javascript for .js and .jsx', () => {
    expect(getLanguage('file.js')).toBe('javascript');
    expect(getLanguage('file.jsx')).toBe('javascript');
  });

  it('returns typescript for .ts and .tsx', () => {
    expect(getLanguage('file.ts')).toBe('typescript');
    expect(getLanguage('file.tsx')).toBe('typescript');
  });

  it('returns language for common extensions', () => {
    expect(getLanguage('a.py')).toBe('python');
    expect(getLanguage('a.json')).toBe('json');
    expect(getLanguage('a.md')).toBe('markdown');
    expect(getLanguage('a.html')).toBe('html');
    expect(getLanguage('a.css')).toBe('css');
    expect(getLanguage('a.yaml')).toBe('yaml');
    expect(getLanguage('a.yml')).toBe('yaml');
    expect(getLanguage('a.sh')).toBe('shell');
    expect(getLanguage('a.rs')).toBe('rust');
    expect(getLanguage('a.go')).toBe('go');
    expect(getLanguage('a.java')).toBe('java');
    expect(getLanguage('a.c')).toBe('c');
    expect(getLanguage('a.cpp')).toBe('cpp');
    expect(getLanguage('a.hpp')).toBe('cpp');
  });

  it('returns plaintext for unknown extension', () => {
    expect(getLanguage('file.xyz')).toBe('plaintext');
  });

  it('returns plaintext for empty or no extension', () => {
    expect(getLanguage('')).toBe('plaintext');
    expect(getLanguage(null)).toBe('plaintext');
    expect(getLanguage(undefined)).toBe('plaintext');
    expect(getLanguage('Makefile')).toBe('plaintext');
  });
});
