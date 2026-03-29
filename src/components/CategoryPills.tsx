import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { getCategoryLabel, getCategoryColor, UNCLASSIFIED_CATEGORY_KEY } from '@/theme/categories';

export const CUSTOM_CATEGORY_PREFIX = 'custom:';

/** Colors for custom / À classifier pills when no base category color exists */
const CUSTOM_PILL_COLORS = ['#B07FD4', '#E07C5C', '#5B9FE8', '#52B788'];

function getPillColor(value: string | null, index: number, neutralColor: string): string {
  if (value === null) return neutralColor;
  if (value === 'custom') return '#E07C5C';
  if (value.startsWith(CUSTOM_CATEGORY_PREFIX)) {
    return CUSTOM_PILL_COLORS[index % CUSTOM_PILL_COLORS.length];
  }
  return getCategoryColor(value);
}

interface CategoryPillsProps {
  categories: string[];
  customCategories?: string[];
  includeAClassifier: boolean;
  active: string | null;
  onSelect: (value: string | null) => void;
}

export function CategoryPills({
  categories,
  customCategories = [],
  includeAClassifier,
  active,
  onSelect,
}: CategoryPillsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pills: { value: string; label: string }[] = [
    ...categories
      .filter((c) => c !== 'custom')
      .map((c) => ({ value: c, label: getCategoryLabel(c) })),
    ...customCategories.map((label) => ({ value: `${CUSTOM_CATEGORY_PREFIX}${label}`, label })),
    ...(includeAClassifier && !customCategories.includes(UNCLASSIFIED_CATEGORY_KEY)
      ? [{ value: 'custom', label: t('categories.aClassifier') }]
      : []),
  ];

  const isFullWidth = (value: string) => value === 'custom';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        alignContent: 'flex-start',
      }}
    >
      {pills.map(({ value, label }, index) => {
        const isActive = value === active;
        const accent = getPillColor(value, index, colors.border);
        const iconBg = `${accent}30`;
        const buttonBorder = isActive ? accent : colors.border;
        const textColor = isActive ? accent : colors.text1;
        const iconColor = accent;
        return (
          <button
            key={value}
            type="button"
            style={{
              gridColumn: isFullWidth(value) ? '1 / -1' : undefined,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              height: 50,
              width: '100%',
              borderRadius: 12,
              background: colors.surface2,
              border: `1px solid ${buttonBorder}`,
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              color: textColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            onClick={() => onSelect(value)}
          >
            <span
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: 10,
                background: iconBg,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <FileText size={16} strokeWidth={2} style={{ color: iconColor }} />
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
