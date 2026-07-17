import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, existsSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventEmitter } from 'events';
import { EVENTS } from '../../core/eventBus.js';
import {
  attachSessionRecorder,
  listSessions,
  loadSession,
  latestSession,
} from '../session.js';

let dir;
let bus;

const tick = () => new Promise(r => setTimeout(r, 80));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'session-test-'));
  bus = new EventEmitter();
});

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('attachSessionRecorder — basic capture', () => {
  it('creates a session file on first USER_MESSAGE', async () => {
    attachSessionRecorder(bus, dir);
    bus.emit(EVENTS.USER_MESSAGE, { text: 'hello agent' });
    await tick();
    const files = readdirSync(join(dir, '.emotion-sessions')).filter(n => n.endsWith('.json'));
    expect(files.length).toBe(1);
  });

  it('records a full user → assistant turn', async () => {
    attachSessionRecorder(bus, dir);
    bus.emit(EVENTS.USER_MESSAGE, { text: 'what is 2+2?' });
    await tick();
    bus.emit(EVENTS.LLM_TOKEN, { token: 'The ' });
    bus.emit(EVENTS.LLM_TOKEN, { token: 'answer ' });
    bus.emit(EVENTS.LLM_TOKEN, { token: 'is 4.' });
    bus.emit(EVENTS.LLM_DONE, {});
    await tick();

    const list = await listSessions(dir);
    expect(list.length).toBe(1);
    const loaded = await loadSession(dir, list[0].id);
    expect(loaded.session.messages.length).toBe(2);
    expect(loaded.session.messages[0].role).toBe('user');
    expect(loaded.session.messages[0].content).toBe('what is 2+2?');
    expect(loaded.session.messages[1].role).toBe('assistant');
    expect(loaded.session.messages[1].content).toBe('The answer is 4.');
  });

  it('ignores slash commands as user messages', async () => {
    attachSessionRecorder(bus, dir);
    bus.emit(EVENTS.USER_MESSAGE, { text: '/teach' });
    bus.emit(EVENTS.USER_MESSAGE, { text: '/auto' });
    await tick();
    expect(existsSync(join(dir, '.emotion-sessions'))).toBe(false);
  });

  it('ignores empty/whitespace user messages', async () => {
    attachSessionRecorder(bus, dir);
    bus.emit(EVENTS.USER_MESSAGE, { text: '' });
    bus.emit(EVENTS.USER_MESSAGE, { text: '   \n  ' });
    bus.emit(EVENTS.USER_MESSAGE, { text: null });
    await tick();
    expect(existsSync(join(dir, '.emotion-sessions'))).toBe(false);
  });

  it('does NOT record an assistant turn when LLM_DONE fires without any tokens', async () => {
    attachSessionRecorder(bus, dir);
    bus.emit(EVENTS.USER_MESSAGE, { text: 'hi' });
    await tick();
    bus.emit(EVENTS.LLM_DONE, {});
    await tick();
    const list = await listSessions(dir);
    const loaded = await loadSession(dir, list[0].id);
    expect(loaded.session.messages.length).toBe(1);
    expect(loaded.session.messages[0].role).toBe('user');
  });
});

describe('listSessions', () => {
  it('returns empty array when no sessions dir exists', async () => {
    const result = await listSessions(dir);
    expect(result).toEqual([]);
  });

  it('returns sessions newest-first', async () => {
    const sessionsDir = join(dir, '.emotion-sessions');
    mkdirSync(sessionsDir, { recursive: true });
    const ids = ['1000000000001', '1000000000003', '1000000000002'];
    for (const id of ids) {
      writeFileSync(
        join(sessionsDir, `${id}.json`),
        JSON.stringify({ id, startedAt: '2026', messages: [{ role: 'user', content: `msg ${id}` }] })
      );
    }
    const list = await listSessions(dir);
    expect(list.map(s => s.id)).toEqual(['1000000000003', '1000000000002', '1000000000001']);
  });

  it('respects the limit', async () => {
    const sessionsDir = join(dir, '.emotion-sessions');
    mkdirSync(sessionsDir, { recursive: true });
    for (let i = 1; i <= 10; i++) {
      const id = `100000000000${i}`;
      writeFileSync(
        join(sessionsDir, `${id}.json`),
        JSON.stringify({ id, startedAt: '2026', messages: [] })
      );
    }
    const list = await listSessions(dir, 3);
    expect(list.length).toBe(3);
  });
});

describe('loadSession', () => {
  it('errors on missing id', async () => {
    const result = await loadSession(dir, '');
    expect(result.error).toMatch(/required/);
  });

  it('errors on invalid id format (prevents path traversal)', async () => {
    const result = await loadSession(dir, '../etc/passwd');
    expect(result.error).toMatch(/invalid session id format/);
  });

  it('errors when session file does not exist', async () => {
    const result = await loadSession(dir, '9999999999999');
    expect(result.error).toMatch(/not found/);
  });
});

describe('latestSession', () => {
  it('returns found:false when no sessions exist', async () => {
    const result = await latestSession(dir);
    expect(result.found).toBe(false);
  });

  it('returns the most recent session', async () => {
    const sessionsDir = join(dir, '.emotion-sessions');
    mkdirSync(sessionsDir, { recursive: true });
    const newer = '1000000000099';
    const older = '1000000000001';
    writeFileSync(join(sessionsDir, `${older}.json`), JSON.stringify({ id: older, messages: [] }));
    writeFileSync(join(sessionsDir, `${newer}.json`), JSON.stringify({ id: newer, messages: [] }));
    const result = await latestSession(dir);
    expect(result.found).toBe(true);
    expect(result.session.id).toBe(newer);
  });
});

describe('auto-prune', () => {
  it('keeps only the 30 most recent sessions after a new write', async () => {
    const sessionsDir = join(dir, '.emotion-sessions');
    mkdirSync(sessionsDir, { recursive: true });
    for (let i = 1; i <= 31; i++) {
      const id = String(1_000_000_000_000 + i);
      writeFileSync(
        join(sessionsDir, `${id}.json`),
        JSON.stringify({ id, startedAt: '2026', messages: [] })
      );
    }
    expect(readdirSync(sessionsDir).filter(n => n.endsWith('.json')).length).toBe(31);

    attachSessionRecorder(bus, dir);
    bus.emit(EVENTS.USER_MESSAGE, { text: 'trigger a write' });
    await tick();

    const remaining = readdirSync(sessionsDir).filter(n => n.endsWith('.json'));
    expect(remaining.length).toBe(30);
  });
});

describe('symlink protection', () => {
  it('does not write session content when .emotion-sessions is a symlink to outside workspace', async () => {
    const outsideDir = join(
      tmpdir(),
      `outside-sessions-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    );
    mkdirSync(outsideDir, { recursive: true });

    const linkPath = join(dir, '.emotion-sessions');
    symlinkSync(outsideDir, linkPath);

    try {
      attachSessionRecorder(bus, dir);
      bus.emit(EVENTS.USER_MESSAGE, { text: 'this should NOT be persisted to outside' });
      await tick();

      // Verify no session file was created in the outside target.
      const outsideFiles = readdirSync(outsideDir);
      expect(outsideFiles.length).toBe(0);
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('returns empty list when .emotion-sessions is a symlink to outside workspace', async () => {
    const outsideDir = join(
      tmpdir(),
      `outside-sessions-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    );
    mkdirSync(outsideDir, { recursive: true });
    // Plant a fake session file in the outside dir
    writeFileSync(
      join(outsideDir, '1234567890.json'),
      JSON.stringify({ id: '1234567890', startedAt: '2026', messages: [{ role: 'user', content: 'leaked', ts: '2026' }] }),
    );

    const linkPath = join(dir, '.emotion-sessions');
    symlinkSync(outsideDir, linkPath);

    try {
      const sessions = await listSessions(dir);
      expect(sessions).toEqual([]);
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
