const FRUSTRATION_KEYWORDS = [
  'ugh', 'wtf', 'hate', 'stupid', 'useless', 'garbage', 'trash',
  'awful', 'terrible', 'ridiculous', 'annoying', 'frustrated', 'frustrating',
  'nothing works', 'keeps breaking', 'still broken', "why isn't", "why won't"
];

const PANIC_KEYWORDS = [
  'please help', 'need help', 'no idea', "can't figure", 'cant figure',
  'completely lost', 'totally lost', "don't understand", 'dont understand',
  'makes no sense', 'have no clue', 'no clue', 'what is going on'
];

const COMMON_ACRONYMS = new Set(['api', 'cli', 'url', 'html', 'css', 'json', 'sql', 'ide', 'npm', 'git']);

/**
 * Detect whether a user message may indicate frustration, panic, or support need.
 * Pure function — no side effects, no LLM calls.
 * @returns {{ needsSupport: boolean, severity: 'none'|'low'|'medium', signals: string[] }}
 */
export function detectSupportNeed(text) {
  if (!text || !text.trim()) {
    return { needsSupport: false, severity: 'none', signals: [] };
  }

  const lower = text.toLowerCase();
  const signals = [];

  if (FRUSTRATION_KEYWORDS.some((kw) => lower.includes(kw))) {
    signals.push('frustration_keywords');
  }

  if (PANIC_KEYWORDS.some((kw) => lower.includes(kw))) {
    signals.push('panic_keywords');
  }

  // 3+ consecutive !? or 5+ total !
  if (/[!?]{3,}/.test(text) || (text.match(/!/g) || []).length >= 5) {
    signals.push('excessive_punctuation');
  }

  // 2+ words of 4+ chars in ALL CAPS, excluding common acronyms
  const capsWords = text.split(/\s+/).filter(
    (w) => w.length >= 4 && w === w.toUpperCase() && /[A-Z]/.test(w) && !COMMON_ACRONYMS.has(w.toLowerCase())
  );
  if (capsWords.length >= 2) {
    signals.push('all_caps_intensity');
  }

  // A single question word appears 2+ times, OR 3+ question marks spread across the message
  const qWordMatches = lower.match(/\b(why|how|what|where|when)\b/g) || [];
  const qWordCounts = {};
  for (const w of qWordMatches) { qWordCounts[w] = (qWordCounts[w] || 0) + 1; }
  const hasRepeatedQWord = Object.values(qWordCounts).some((c) => c >= 2);
  const questionMarkCount = (text.match(/\?/g) || []).length;
  if (hasRepeatedQWord || questionMarkCount >= 3) {
    signals.push('repeat_question_pattern');
  }

  const needsSupport = signals.length > 0;
  const severity = signals.length === 0 ? 'none' : signals.length === 1 ? 'low' : 'medium';

  return { needsSupport, severity, signals };
}
