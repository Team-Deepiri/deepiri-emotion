/**
 * Attachment helpers: clipboard image grab + file-path image resolver.
 *
 * Two capture methods:
 *   1. grabClipboardImage() — macOS clipboard via pngpaste or osascript (Ctrl+V in TUI)
 *   2. resolveImagePath(text) — detect an image file path typed/pasted into the prompt
 *
 * Attachment shape: { path: string, mime: string, base64: string }
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

const MIME_MAP = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
};

/**
 * Sniff MIME type from file extension.
 * @param {string} filePath
 * @returns {string}
 */
export function mimeFromPath(filePath) {
  return MIME_MAP[extname(filePath).toLowerCase()] || 'image/png';
}

/**
 * Read a file and return its base64 content.
 * @param {string} filePath
 * @returns {string}
 */
export function toBase64(filePath) {
  return readFileSync(filePath).toString('base64');
}

/**
 * Grab whatever image is on the macOS clipboard and save to a temp PNG file.
 * Returns an attachment object, or null if no image is on the clipboard or
 * we're not on macOS.
 *
 * Strategies tried in order:
 *   1. `pngpaste <dest>` — fast native tool (brew install pngpaste)
 *   2. osascript — reads clipboard as PNG data and writes the file
 *
 * @returns {Promise<{ path: string, mime: string, base64: string } | null>}
 */
export async function grabClipboardImage() {
  if (process.platform !== 'darwin') return null;

  const dest = join(tmpdir(), `deepiri-attach-${Date.now()}.png`);

  // Strategy 1: pngpaste (preferred, no AppleScript overhead)
  try {
    execFileSync('pngpaste', [dest], { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
    if (existsSync(dest)) {
      return { path: dest, mime: 'image/png', base64: toBase64(dest) };
    }
  } catch {
    // pngpaste not installed or clipboard has no image — fall through
  }

  // Strategy 2: osascript — write PNG clipboard data to file
  try {
    // Single-quoted AppleScript; escape internal single quotes.
    const script = [
      `set imgData to the clipboard as «class PNGf»`,
      `set tmpFile to POSIX file "${dest}"`,
      `set fileRef to open for access tmpFile with write permission`,
      `write imgData to fileRef`,
      `close access fileRef`,
    ].join('\n');
    execSync(`osascript << 'OSASCRIPT_EOF'\n${script}\nOSASCRIPT_EOF`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    if (existsSync(dest)) {
      return { path: dest, mime: 'image/png', base64: toBase64(dest) };
    }
  } catch {
    // No PNG on clipboard or osascript error
  }

  return null;
}

/**
 * Scan `text` for an image file path token. If found and the file exists,
 * return the attachment object and the text with the path token removed.
 * Returns null if no image path detected.
 *
 * @param {string} text  Raw user input.
 * @returns {{ attachment: { path: string, mime: string, base64: string }, text: string } | null}
 */
export function resolveImagePath(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  for (const token of tokens) {
    const ext = extname(token).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    if (!existsSync(token)) continue;
    try {
      const base64 = toBase64(token);
      const mime   = mimeFromPath(token);
      // Remove the path token; keep remaining text (fall back to original if empty)
      const cleanedText = trimmed.replace(token, '').replace(/\s+/g, ' ').trim() || trimmed;
      return { attachment: { path: token, mime, base64 }, text: cleanedText };
    } catch {
      // unreadable — skip
    }
  }
  return null;
}
