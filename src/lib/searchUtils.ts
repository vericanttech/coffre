/**
 * Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Returns true if `needle` matches inside `haystack` with typo tolerance:
 * - exact substring match (case-insensitive), or
 * - any word in haystack is within `maxEditDistance` of needle.
 * Use for search so "permis" matches "Permis" and "permiz" still matches "permis".
 */
export function fuzzyIncludes(
  haystack: string,
  needle: string,
  maxEditDistance = 2
): boolean {
  const h = (haystack || '').toLowerCase();
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  if (h.includes(n)) return true;
  const words = h.split(/\s+/).filter((w) => w.length > 0);
  for (const word of words) {
    if (Math.abs(word.length - n.length) > maxEditDistance) continue;
    if (levenshteinDistance(word, n) <= maxEditDistance) return true;
  }
  return false;
}
