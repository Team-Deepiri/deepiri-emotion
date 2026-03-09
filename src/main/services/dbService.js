/**
 * Local SQLite DB (sql.js) in userData. Used for chat history and future structured data.
 * DB file: userData/app.db. All access from main process only; renderer uses IPC.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';
import { IPC } from '../../shared/ipcChannels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..', '..', '..');

let db = null;
let SQL = null;

const DEFAULT_SESSION = 'default';
const CHAT_HISTORY_LIMIT = 200;

async function getDb() {
  if (db) return db;
  const initSqlJs = (await import('sql.js')).default;
  SQL = await initSqlJs({
    locateFile: (file) => join(APP_ROOT, 'node_modules', 'sql.js', 'dist', file)
  });
  const userData = app.getPath('userData');
  const dbPath = join(userData, 'app.db');
  mkdirSync(userData, { recursive: true });
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL DEFAULT '${DEFAULT_SESSION}',
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

function persistDb() {
  if (!db || !SQL) return;
  try {
    const userData = app.getPath('userData');
    const dbPath = join(userData, 'app.db');
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('[dbService] persist failed:', err);
  }
}

/**
 * @param {import('electron').IpcMain} ipcMain
 */
export function registerDbService(ipcMain) {
  ipcMain.handle(IPC.DB_GET_CHAT_HISTORY, async (_event, sessionId = DEFAULT_SESSION, limit = 50) => {
    try {
      const database = await getDb();
      const stmt = database.prepare(
        'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
      );
      stmt.bind([sessionId]);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      const slice = rows.slice(-Math.min(limit, CHAT_HISTORY_LIMIT));
      return { success: true, data: slice };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.DB_APPEND_CHAT_MESSAGE, async (_event, { role, content, sessionId = DEFAULT_SESSION }) => {
    try {
      const database = await getDb();
      database.run(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)',
        [sessionId, role, content]
      );
      persistDb();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.DB_CLEAR_CHAT_HISTORY, async (_event, sessionId = DEFAULT_SESSION) => {
    try {
      const database = await getDb();
      database.run('DELETE FROM chat_messages WHERE session_id = ?', [sessionId]);
      persistDb();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}
