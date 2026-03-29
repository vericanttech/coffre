import { Home, Search, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';

const iconSize = 22;
const fabIconSize = 24;

interface BottomNavProps {
  currentTab: number;
  onTabChange: (tab: number) => void;
  onFAB: () => void;
}

export function BottomNav({ currentTab, onTabChange, onFAB }: BottomNavProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    background: colors.surface,
    borderTop: `1px solid ${colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 'env(safe-area-inset-bottom)',
  };
  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    color: active ? colors.primary : colors.text2,
    fontSize: 11,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    cursor: 'pointer',
  });
  const fabStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: 28,
    border: 'none',
    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
    color: colors.bg,
    fontSize: 24,
    lineHeight: 1,
    cursor: 'pointer',
    boxShadow: `0 4px 12px ${colors.primary}22`,
  };
  return (
    <nav style={navStyle}>
      <button
        type="button"
        style={itemStyle(currentTab === 0)}
        onClick={() => onTabChange(0)}
        aria-label={t('nav.home')}
      >
        <Home size={iconSize} strokeWidth={2} />
        {t('nav.home')}
      </button>
      <button type="button" style={fabStyle} onClick={onFAB} aria-label={t('nav.add')}>
        <Plus size={fabIconSize} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        style={itemStyle(currentTab === 1)}
        onClick={() => onTabChange(1)}
        aria-label={t('nav.search')}
      >
        <Search size={iconSize} strokeWidth={2} />
        {t('nav.search')}
      </button>
    </nav>
  );
}
