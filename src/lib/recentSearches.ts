const STORAGE_KEY_PREFIX = 'trouvedoc_recent_searches';
const MAX_RECENT = 8;

function storageKey(userId: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : STORAGE_KEY_PREFIX;
}

export function getRecentSearches(userId: string | null): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(userId: string | null, query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  const prev = getRecentSearches(userId);
  const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}
