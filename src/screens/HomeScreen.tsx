import { Search, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useDocuments } from '@/hooks/useDocuments';
import { useTheme } from '@/context/ThemeContext';
import { CategoryPills } from '@/components/CategoryPills';
import { UNCLASSIFIED_CATEGORY_KEY } from '@/theme/categories';
import type { VaultDocument } from '@/types/vault';

function useSummary(docs: VaultDocument[]) {
  const categorySet = new Set<string>();
  const customCategorySet = new Set<string>();

  docs.forEach((d) => {
    categorySet.add(d.category);
    if (d.category === 'custom' && d.customCategory) {
      customCategorySet.add(d.customCategory);
    }
  });

  const categories = Array.from(categorySet);
  const customCategories = Array.from(customCategorySet).sort();
  const hasAClassifier = docs.some(
    (d) => d.status === 'ocr_failed' || (d.category === 'custom' && d.customCategory === UNCLASSIFIED_CATEGORY_KEY)
  );
  return { categories, customCategories, hasAClassifier };
}

interface HomeScreenProps {
  onOpenSearch: (filter: string | null) => void;
  /** When set (mobile), show top bar with user name + initial that opens Profile */
  onOpenProfile?: () => void;
}

export function HomeScreen({ onOpenSearch, onOpenProfile }: HomeScreenProps) {
  useScreenAnalytics('Home');
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const docs = useDocuments(user?.uid ?? null);
  const { categories, customCategories, hasAClassifier } = useSummary(docs);

  const displayName = user?.displayName || user?.email?.split('@')[0] || t('profile.user');
  const initial = (displayName[0] ?? 'U').toUpperCase();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  };

  return (
    <div style={containerStyle}>
      {/* Mobile-only top bar: user name left, first letter (→ Profile) right */}
      {onOpenProfile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: colors.text1 }}>{displayName}</span>
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label={t('nav.profile')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              border: `2px solid ${colors.primary}`,
              background: colors.surface,
              color: colors.primary,
              fontSize: 18,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {initial}
          </button>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => onOpenSearch(null)}
          style={{
            flex: 1,
            padding: '14px 16px',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            color: colors.text2,
            fontSize: 14,
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Search size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
          {t('home.searchPlaceholder')}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          title={t('home.refresh')}
          style={{
            padding: 14,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            color: colors.text2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RefreshCw size={20} strokeWidth={2} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <CategoryPills
          categories={categories}
          customCategories={customCategories}
          includeAClassifier={hasAClassifier}
          active={null}
          onSelect={(value) => onOpenSearch(value)}
        />
      </div>
    </div>
  );
}
