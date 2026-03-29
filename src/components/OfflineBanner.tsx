import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOffline } from '@/context/OfflineContext';
import { useTheme } from '@/context/ThemeContext';

export function OfflineBanner() {
  const { t } = useTranslation();
  const offline = useOffline();
  const { colors } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!offline) setDismissed(false);
  }, [offline]);

  if (!offline || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 12,
        insetInlineEnd: 12,
        insetInlineStart: 'auto',
        maxWidth: 320,
        zIndex: 9999,
        background: colors.surface3,
        color: colors.text2,
        padding: '10px 12px 10px 14px',
        fontSize: 13,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ flex: 1 }}>
        {t('offlineBanner.message')}
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        title={t('offlineBanner.close')}
        aria-label={t('offlineBanner.close')}
        style={{
          background: 'none',
          border: 'none',
          padding: 4,
          color: colors.text2,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
