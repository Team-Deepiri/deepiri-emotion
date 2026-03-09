/**
 * Integration service tests (Node env). Uses temp dir for store and mocks axios for sync.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import axios from 'axios';

const TEST_USER_DATA = join(tmpdir(), `integration-service-test-${Date.now()}`);

vi.mock('electron', () => ({
  app: {
    getPath: () => TEST_USER_DATA
  }
}));

// Load service after mock so it uses TEST_USER_DATA
const { registerIntegrationService } = await import('../integrationService.js');

describe('integrationService', () => {
  let handlers = {};
  const ipcMain = {
    handle: (channel, handler) => {
      handlers[channel] = handler;
    }
  };

  beforeEach(async () => {
    handlers = {};
    if (existsSync(TEST_USER_DATA)) {
      await rm(TEST_USER_DATA, { recursive: true });
    }
    await mkdir(TEST_USER_DATA, { recursive: true });
    registerIntegrationService(ipcMain, {});
  });

  afterEach(async () => {
    if (existsSync(TEST_USER_DATA)) {
      await rm(TEST_USER_DATA, { recursive: true }).catch(() => {});
    }
  });

  it('GET_INTEGRATION_STATUS returns empty connected when no store', async () => {
    const getStatus = handlers['get-integration-status'];
    expect(getStatus).toBeDefined();
    const result = await getStatus(null);
    expect(result).toEqual({ connected: {} });
  });

  it('CONNECT_INTEGRATION then GET_INTEGRATION_STATUS returns connected', async () => {
    const connect = handlers['connect-integration'];
    const getStatus = handlers['get-integration-status'];
    await connect(null, { id: 'github', token: 'test-token', label: 'GitHub' });
    const result = await getStatus(null);
    expect(result.connected.github).toBeDefined();
    expect(result.connected.github.label).toBe('GitHub');
  });

  it('DISCONNECT_INTEGRATION removes credentials', async () => {
    const connect = handlers['connect-integration'];
    const disconnect = handlers['disconnect-integration'];
    const getStatus = handlers['get-integration-status'];
    await connect(null, { id: 'github', token: 'x' });
    expect((await getStatus(null)).connected.github).toBeDefined();
    await disconnect(null, 'github');
    expect((await getStatus(null)).connected.github).toBeUndefined();
  });

  it('SYNC_INTEGRATION returns error when not connected', async () => {
    const sync = handlers['sync-integration'];
    const result = await sync(null, { id: 'github', options: { repo: 'owner/repo' } });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not connected');
  });

  it('SYNC_INTEGRATION GitHub returns issues when connected and axios mocked', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: [
        { id: 1, number: 1, title: 'Issue 1', body: 'Body', html_url: 'https://github.com/o/r/issues/1', state: 'open', created_at: '', updated_at: '' }
      ]
    });
    const connect = handlers['connect-integration'];
    const sync = handlers['sync-integration'];
    await connect(null, { id: 'github', token: 'token' });
    const result = await sync(null, { id: 'github', options: { repo: 'owner/repo' } });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0].title).toBe('Issue 1');
    expect(result.data[0].number).toBe(1);
    vi.restoreAllMocks();
  });

  it('INTEGRATION_SUPPORTED returns true for github/notion', async () => {
    const supported = handlers['integration-supported'];
    expect(await supported(null, 'github')).toBe(true);
    expect(await supported(null, 'notion')).toBe(true);
    expect(await supported(null, 'unknown')).toBe(false);
  });
});
