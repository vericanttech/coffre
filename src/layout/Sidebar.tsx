import { Home, Search, Bell, User, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';

const SIDEBAR_WIDTH = 240;
const iconSize = 20;

// Alerts (tab 2) commented out for now. TODO: turn into Insights.
const navIcons = [Home, Search, Bell, User] as const;

interface SidebarProps {
  currentTab: number;
  onTabChange: (tab: number) => void;
  onAdd: () => void;
}

export function Sidebar({ currentTab, onTabChange, onAdd }: SidebarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const labels: Record<number, string> = {
    0: t('nav.home'),
    1: t('nav.search'),
    // 2: t('nav.alerts'), // commented out – turn into Insights
    3: t('nav.profile'),
  };
  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    background: colors.surface,
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 24,
    paddingBottom: 24,
  };
  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 20px',
    margin: '0 12px',
    borderRadius: 12,
    border: 'none',
    background: active ? `${colors.primary}18` : 'transparent',
    color: active ? colors.primary : colors.text2,
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left',
    cursor: 'pointer',
    minHeight: 44,
  });
  const addBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    margin: '12px 20px',
    padding: '14px 20px',
    borderRadius: 12,
    border: 'none',
    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
    color: colors.bg,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: `0 4px 12px ${colors.primary}22`,
  };
  const logoStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 700,
    color: colors.primary,
    padding: '0 20px 20px',
    marginBottom: 8,
    borderBottom: `1px solid ${colors.border}`,
  };
  return (
    <aside style={sidebarStyle} className="sidebar" aria-label="Navigation principale">
      <div style={logoStyle}>{t('sidebar.logo')}</div>
      <button type="button" style={addBtnStyle} onClick={onAdd} aria-label={t('nav.addDocument')}>
        <Plus size={18} strokeWidth={2.5} />
        {t('nav.add')}
      </button>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Tabs 0, 3 only; tab 2 (Alerts) commented out – TODO: turn into Insights */}
        {([0, 1, 3] as const).map((tab) => {
          const Icon = navIcons[tab];
          return (
            <button
              key={tab}
              type="button"
              style={navItemStyle(currentTab === tab)}
              onClick={() => onTabChange(tab)}
              aria-label={labels[tab]}
            >
              <Icon size={iconSize} strokeWidth={2} />
              {labels[tab]}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export const SIDEBAR_WIDTH_PX = SIDEBAR_WIDTH;
