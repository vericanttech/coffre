import { useState, useMemo, useEffect, useRef } from 'react';
import { Search as SearchIcon, X, Sparkles, Loader2, List, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocuments } from '@/hooks/useDocuments';
import { useTheme } from '@/context/ThemeContext';
import { VaultDocumentCard } from '@/components/VaultDocumentCard';
import { CUSTOM_CATEGORY_PREFIX } from '@/components/CategoryPills';
import { logSearch } from '@/lib/analytics';
import { fuzzyIncludes } from '@/lib/searchUtils';
import { expandSearchQuery as expandSearchQueryApi } from '@/services/expandSearchQuery';
import type { VaultDocument } from '@/types/vault';
import { getCategoryLabel, getCategoryColor, UNCLASSIFIED_CATEGORY_KEY } from '@/theme/categories';
import { useCompactView } from '@/hooks/useCompactView';

/** Format doc.createdAt for compact list display (no network). */
function formatDocDate(createdAt: VaultDocument['createdAt']): string {
  if (!createdAt) return '';
  const d = createdAt instanceof Date ? createdAt : new Date((createdAt as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function getLabelFromFilter(filter: string | null): string {
  if (!filter || filter === 'Tous') return '';
  if (filter.startsWith(CUSTOM_CATEGORY_PREFIX)) return filter.slice(CUSTOM_CATEGORY_PREFIX.length);
  if (filter === 'custom') return getCategoryLabel('custom', UNCLASSIFIED_CATEGORY_KEY);
  return getCategoryLabel(filter);
}

/** Match doc against a single term (title, category, summary, keywords). */
function docMatchesTerm(d: VaultDocument, term: string): boolean {
  const title = d.title;
  const cat = getCategoryLabel(d.category, d.customCategory);
  const summary = d.ocrSummary || '';
  const keys = (d.keywords || []).join(' ');
  return (
    fuzzyIncludes(title, term) ||
    fuzzyIncludes(cat, term) ||
    fuzzyIncludes(summary, term) ||
    fuzzyIncludes(keys, term)
  );
}

function filterDocs(
  docs: VaultDocument[],
  query: string,
  categoryFilter: string | null,
  expandedKeywords: string[] = []
): VaultDocument[] {
  let list = docs;
  if (categoryFilter) {
    if (categoryFilter.startsWith(CUSTOM_CATEGORY_PREFIX)) {
      const customLabel = categoryFilter.slice(CUSTOM_CATEGORY_PREFIX.length);
      list = list.filter((d) => d.category === 'custom' && d.customCategory === customLabel);
    } else if (categoryFilter === 'custom') {
      list = list.filter((d) => d.category === 'custom' || d.status === 'ocr_failed');
    } else {
      list = list.filter((d) => d.category === categoryFilter);
    }
  }
  const q = query.trim();
  const termsToMatch = [q, ...expandedKeywords].filter(Boolean);
  if (termsToMatch.length === 0) return list;
  const categoryLabel = categoryFilter ? getLabelFromFilter(categoryFilter) : '';
  if (categoryLabel && q === categoryLabel && expandedKeywords.length === 0) return list;
  // Inclusive: show doc if it matches the query OR any expanded keyword
  return list.filter((d) => {
    return termsToMatch.some((term) => docMatchesTerm(d, term));
  });
}

interface SearchScreenProps {
  initialFilter: string | null;
  onClearInitialFilter: () => void;
  onOpenDocument?: (doc: VaultDocument) => void;
}

export function SearchScreen({ initialFilter, onClearInitialFilter, onOpenDocument }: SearchScreenProps) {
  useScreenAnalytics('Search');
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const docs = useDocuments(user?.uid ?? null);
  const [compactView, setCompactView] = useCompactView();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [aiBoost, setAiBoost] = useState(false);
  /** Manual AI mode: last query sent to backend and keywords returned (one-time filter). */
  const [aiSearchQuery, setAiSearchQuery] = useState<string | null>(null);
  const [aiExpandedKeywords, setAiExpandedKeywords] = useState<string[]>([]);
  const [expandLoading, setExpandLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const shouldFocusSearchInput = useRef(initialFilter === null);

  useEffect(() => {
    if (shouldFocusSearchInput.current) {
      searchInputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (initialFilter != null) {
      const filterValue = initialFilter === 'Tous' ? null : initialFilter;
      setCategoryFilter(filterValue);
      setQuery(getLabelFromFilter(initialFilter));
      onClearInitialFilter();
    }
  }, [initialFilter, onClearInitialFilter]);

  useEffect(() => {
    if (!query.trim()) setCategoryFilter(null);
  }, [query]);

  // Build vault context from current docs (unique categories + sample titles)
  const vaultContext = useMemo(() => {
    const categories = Array.from(
      new Set(
        docs.map((d) => getCategoryLabel(d.category, d.customCategory)).filter(Boolean)
      )
    );
    const sampleTitles = docs.slice(0, 30).map((d) => d.title).filter(Boolean);
    return { categories, sampleTitles };
  }, [docs]);

  // Manual AI search: only when user clicks Search or presses Enter (AI mode)
  const runAiSearch = () => {
    const q = query.trim();
    if (!aiBoost || !q) return;
    setExpandLoading(true);
    expandSearchQueryApi({ query: q, vaultContext })
      .then((res) => {
        setAiSearchQuery(q);
        setAiExpandedKeywords(res.keywords ?? []);
        logSearch(q, 0); // count logged after filter in next tick
      })
      .catch(() => {
        setAiSearchQuery(q);
        setAiExpandedKeywords([]);
      })
      .finally(() => setExpandLoading(false));
  };

  const clearAiResults = () => {
    setAiSearchQuery(null);
    setAiExpandedKeywords([]);
  };

  // Live filter when AI Boost OFF; one-time filter from last AI result when AI Boost ON
  const filtered = useMemo(() => {
    if (!aiBoost) {
      return filterDocs(docs, debouncedQuery, categoryFilter, []);
    }
    if (aiSearchQuery !== null) {
      return filterDocs(docs, aiSearchQuery, categoryFilter, aiExpandedKeywords);
    }
    return filterDocs(docs, '', categoryFilter, []);
  }, [docs, categoryFilter, aiBoost, debouncedQuery, aiSearchQuery, aiExpandedKeywords]);

  useEffect(() => {
    if (!aiBoost && debouncedQuery.trim()) {
      logSearch(debouncedQuery, filtered.length);
    }
  }, [aiBoost, debouncedQuery, filtered.length]);

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>{t('search.title')}</h1>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: colors.surface,
          border: `1px solid ${colors.primary}`,
          borderRadius: 14,
          marginBottom: 10,
        }}
      >
        <SearchIcon size={20} strokeWidth={2} style={{ color: colors.primary, flexShrink: 0 }} />
        <input
          ref={searchInputRef}
          type="search"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && aiBoost) {
              e.preventDefault();
              runAiSearch();
            }
          }}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: colors.text1,
            fontSize: 14,
            outline: 'none',
          }}
        />
        {query && !aiBoost && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{ background: 'none', border: 'none', color: colors.text2, cursor: 'pointer' }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        )}
        {aiBoost && (
          <button
            type="button"
            onClick={runAiSearch}
            disabled={expandLoading || !query.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: colors.primary,
              color: colors.surface,
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: expandLoading || !query.trim() ? 'not-allowed' : 'pointer',
              opacity: expandLoading || !query.trim() ? 0.9 : 1,
            }}
          >
            {expandLoading ? (
              <Loader2 size={18} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            ) : (
              <Sparkles size={16} strokeWidth={2} />
            )}
            {expandLoading ? t('search.aiBoostLoading') : t('search.searchButton')}
          </button>
        )}
      </div>

      {/* AI Boost toggle + Clear AI Results when in AI mode with results */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setAiBoost((v) => !v);
            if (aiBoost) clearAiResults();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: aiBoost ? colors.primary : colors.surface2,
            color: aiBoost ? colors.surface : colors.text1,
            border: `1px solid ${aiBoost ? colors.primary : colors.text2}`,
            borderRadius: 10,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Sparkles size={16} strokeWidth={2} />
          {t('search.aiBoost')}
        </button>
        <button
          type="button"
          onClick={() => setCompactView(!compactView)}
          title={compactView ? t('settings.grid') : t('settings.compact')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            padding: 0,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            color: colors.text1,
            cursor: 'pointer',
          }}
        >
          {compactView ? <LayoutGrid size={20} strokeWidth={2} /> : <List size={20} strokeWidth={2} />}
        </button>
        {aiBoost && (aiSearchQuery !== null || aiExpandedKeywords.length > 0) && (
          <button
            type="button"
            onClick={clearAiResults}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'none',
              color: colors.text2,
              border: `1px solid ${colors.text2}`,
              borderRadius: 10,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <X size={16} strokeWidth={2} />
            {t('search.clearAiResults')}
          </button>
        )}
      </div>

      {/* AI Suggestion chips (shown after Manual AI search) */}
      {aiBoost && aiExpandedKeywords.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              color: colors.text2,
              marginBottom: 6,
            }}
          >
            {t('search.aiSuggestions')}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {aiExpandedKeywords.map((kw) => (
              <span
                key={kw}
                style={{
                  padding: '6px 10px',
                  background: colors.surface2,
                  color: colors.text1,
                  borderRadius: 8,
                  fontSize: 12,
                  border: `1px solid ${colors.primary}`,
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ color: colors.primary, fontSize: 12, textTransform: 'uppercase', marginBottom: 12 }}>
        {t('search.resultsCount', { count: filtered.length })}
      </div>

      {compactView ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          {filtered.map((d) => {
            const accent = getCategoryColor(d.category);
            return (
              <button
                key={d.id}
                type="button"
                onClick={onOpenDocument ? () => onOpenDocument(d) : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                borderLeft: `4px solid ${accent}`,
                borderRadius: 8,
                  textAlign: 'left',
                  cursor: onOpenDocument ? 'pointer' : 'default',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: accent,
                    opacity: 0.9,
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: 500,
                    fontSize: 13,
                    color: colors.text1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.title}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    color: colors.text2,
                  }}
                >
                  {formatDocDate(d.createdAt)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 14,
            marginBottom: 24,
          }}
        >
          {filtered.map((d) => (
            <VaultDocumentCard
              key={d.id}
              doc={d}
              variant="gallery"
              onClick={onOpenDocument ? () => onOpenDocument(d) : undefined}
            />
          ))}
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <div
          style={{
            marginTop: 16,
            padding: 14,
            background: colors.surface2,
            borderRadius: 12,
            fontSize: 12,
            color: colors.text2,
          }}
        >
          {t('search.hint')}
        </div>
      </section>
    </>
  );
}
