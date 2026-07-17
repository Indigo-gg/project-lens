/**
 * Simple token estimator for snapshots.
 * Uses a rough approximation: ~4 characters per token for English,
 * ~2 characters per token for CJK characters.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let count = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    // CJK characters (Chinese, Japanese, Korean)
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0x3040 && code <= 0x309f) || // Hiragana
      (code >= 0x30a0 && code <= 0x30ff) || // Katakana
      (code >= 0xff00 && code <= 0xffef)    // Fullwidth forms
    ) {
      count += 1; // ~1 token per CJK character
    } else if (code > 127) {
      count += 0.5; // Other non-ASCII
    } else {
      count += 0.25; // ASCII ~4 chars per token
    }
  }

  // Add overhead for JSON structure
  const overhead = Math.floor(text.length / 100) * 2;

  return Math.ceil(count + overhead);
}

export function estimateObjectTokens(obj: unknown): number {
  return estimateTokens(JSON.stringify(obj));
}
