import { Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useInstallPrompt } from '@/context/InstallPromptContext';

export function InstallBanner() {
  const { t } = useTranslation();
  const prompt = useInstallPrompt();
  const { colors } = useTheme();
  if (!prompt?.showBanner) return null;

  return (
    <div
      role="region"
      aria-label={t('installBanner.ariaLabel')}
      style={{
        position: 'fixed',
        bottom: 96,
        left: 16,
        right: 16,
        zIndex: 9998,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: colors.text1 }}>{t('installBanner.title')}</div>
        <div style={{ fontSize: 12, color: colors.text2 }}>{t('installBanner.subtitle')}</div>
      </div>
      <button
        type="button"
        onClick={() => prompt.promptInstall()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          background: colors.primary,
          color: colors.bg,
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Download size={18} strokeWidth={2} />
        {t('installBanner.install')}
      </button>
      <button
        type="button"
        onClick={prompt.dismissBanner}
        aria-label={t('common.close')}
        style={{
          background: 'none',
          border: 'none',
          color: colors.text3,
          padding: 4,
          cursor: 'pointer',
        }}
      >
        <X size={20} strokeWidth={2} />
      </button>
    </div>
  );
}
