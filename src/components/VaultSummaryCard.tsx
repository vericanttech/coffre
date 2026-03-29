import { FolderLock, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { getCategoryLabel } from '@/theme/categories';

interface VaultSummaryCardProps {
  totalDocs: number;
  byCategory: Record<string, number>;
  expiringCount: number;
  aClassifierCount?: number;
}

export function VaultSummaryCard({
  totalDocs,
  byCategory,
  expiringCount,
  aClassifierCount = 0,
}: VaultSummaryCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  type Chip = { label: string; count: number; accent?: boolean };
  const chips: Chip[] = [
    ...Object.entries(byCategory)
      .filter(([k]) => k !== 'custom')
      .map(([cat, n]) => ({ label: getCategoryLabel(cat), count: n })),
    ...(expiringCount > 0 ? [{ label: t('vaultSummary.expiring'), count: expiringCount, accent: true }] : []),
    ...(aClassifierCount > 0 ? [{ label: t('vaultSummary.aClassifier'), count: aClassifierCount }] : []),
  ];

  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${colors.surface2} 0%, ${colors.surface} 100%)`,
        border: `1px solid ${colors.primary}`,
        borderRadius: 16,
        padding: '20px 16px',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <FolderLock size={22} strokeWidth={2} style={{ color: colors.primary, flexShrink: 0 }} />
        <span style={{ fontSize: 22, fontWeight: 700, color: colors.text1 }}>{totalDocs}</span>
        <span style={{ color: colors.text2, fontSize: 14 }}>{t('vaultSummary.documents')}</span>
        <RefreshCw size={18} strokeWidth={2} style={{ marginLeft: 'auto', color: colors.text2, flexShrink: 0 }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {chips.map(({ label, count, accent }) => (
          <span
            key={label}
            style={{
              background: colors.surface3,
              color: accent ? colors.red : colors.text2,
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
            }}
          >
            {label} {count}
          </span>
        ))}
      </div>
    </div>
  );
}
