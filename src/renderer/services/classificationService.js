/**
 * Embedded classification — intent, domain, sentiment.
 * Uses Cyrex / backend when available; fallback to local heuristic.
 */

export async function classifyText(text) {
  if (!text || !String(text).trim()) return { label: 'empty', confidence: 0 };

  const api = window.electronAPI;
  if (api?.classifyTask) {
    try {
      const result = await api.classifyTask(text.trim(), null);
      const label = result?.label ?? result?.category ?? result?.classification ?? 'unknown';
      const confidence = typeof result?.confidence === 'number' ? result.confidence : 0.8;
      return { label, confidence, raw: result };
    } catch (e) {
      return fallbackClassify(text);
    }
  }
  return fallbackClassify(text);
}

function fallbackClassify(text) {
  const t = String(text).toLowerCase();
  if (/\b(function|const|let|var|=>|import|export)\b/.test(t)) return { label: 'code', confidence: 0.7 };
  if (/\b(bug|fix|error|exception)\b/.test(t)) return { label: 'bug_report', confidence: 0.6 };
  if (/\b(how|what|why|explain)\b/.test(t)) return { label: 'question', confidence: 0.6 };
  if (/\b(test|spec|assert)\b/.test(t)) return { label: 'test', confidence: 0.5 };
  if (t.length < 20) return { label: 'short_text', confidence: 0.4 };
  return { label: 'general', confidence: 0.4 };
}

export async function classifySelection(selection) {
  return classifyText(selection || '');
}
