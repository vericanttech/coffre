import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { LogOut, Download, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { auth } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useInstallPrompt } from '@/context/InstallPromptContext';
import { logSignOut } from '@/lib/analytics';
import { clearUser } from '@/services/offlineVaultDb';
import { useTheme } from '@/context/ThemeContext';
import { useCompactView } from '@/hooks/useCompactView';

interface ProfileScreenProps {
  /** On mobile, go back to Home from Profile */
  onBackToHome?: () => void;
}

export function ProfileScreen({ onBackToHome }: ProfileScreenProps) {
  useScreenAnalytics('Profile');
  const { t } = useTranslation();
  const { user } = useAuth();
  const installPrompt = useInstallPrompt();
  const { theme, setTheme, colors } = useTheme();
  const [compactView, setCompactView] = useCompactView();
  const [termsExpanded, setTermsExpanded] = useState(false);
  const displayName = user?.displayName || user?.email?.split('@')[0] || t('profile.user');
  const email = user?.email ?? '';

  async function handleSignOut() {
    if (user?.uid) await clearUser(user.uid).catch(() => {});
    await signOut(auth);
    logSignOut();
  }

  return (
    <>
      {onBackToHome && (
        <button
          type="button"
          onClick={onBackToHome}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            padding: '8px 0',
            background: 'none',
            border: 'none',
            color: colors.primary,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={20} strokeWidth={2} />
          {t('nav.home')}
        </button>
      )}
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>{t('profile.title')}</h1>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
            color: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 28,
            margin: '0 auto 16px',
          }}
        >
          {(displayName[0] ?? 'U').toUpperCase()}
        </div>
        <div style={{ fontWeight: 600, fontSize: 18, color: colors.text1 }}>{displayName}</div>
        {email && <div style={{ fontSize: 13, color: colors.text2 }}>{email}</div>}
      </div>

      <section>
        <div style={{ color: colors.text2, fontSize: 12, marginBottom: 10 }}>{t('profile.settings')}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            marginBottom: 10,
          }}
        >
          <span style={{ color: colors.text1, fontSize: 14 }}>{t('profile.language')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: i18n.language.startsWith('en') ? colors.primary : colors.surface2,
                color: i18n.language.startsWith('en') ? colors.bg : colors.text2,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('profile.english')}
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage('fr')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: i18n.language.startsWith('fr') ? colors.primary : colors.surface2,
                color: i18n.language.startsWith('fr') ? colors.bg : colors.text2,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('profile.french')}
            </button>
          </div>
        </div>
        {installPrompt?.canInstall && !installPrompt?.isInstalled && (
          <button
            type="button"
            onClick={() => installPrompt.promptInstall()}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              color: colors.text1,
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: 10,
              textAlign: 'left',
            }}
          >
            <Download size={18} strokeWidth={2} style={{ color: colors.primary }} />
            {t('profile.installApp')}
          </button>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            marginBottom: 10,
          }}
        >
          <span style={{ color: colors.text1, fontSize: 14 }}>{t('profile.theme')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setTheme('light')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: theme === 'light' ? colors.primary : colors.surface2,
                color: theme === 'light' ? colors.bg : colors.text2,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('profile.light')}
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: theme === 'dark' ? colors.primary : colors.surface2,
                color: theme === 'dark' ? colors.bg : colors.text2,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('profile.dark')}
            </button>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            marginBottom: 10,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ color: colors.text1, fontSize: 14 }}>{t('settings.compactView')}</div>
            <div style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>{t('settings.compactViewHint')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setCompactView(false)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: !compactView ? colors.primary : colors.surface2,
                color: !compactView ? colors.bg : colors.text2,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('settings.grid')}
            </button>
            <button
              type="button"
              onClick={() => setCompactView(true)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: compactView ? colors.primary : colors.surface2,
                color: compactView ? colors.bg : colors.text2,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('settings.compact')}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 24, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => setTermsExpanded((e) => !e)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '14px 16px',
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: termsExpanded ? '14px 14px 0 0' : 14,
              color: colors.text2,
              fontSize: 12,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span>{t('profile.termsTitle')}</span>
            {termsExpanded ? (
              <ChevronUp size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            ) : (
              <ChevronDown size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            )}
          </button>
          {termsExpanded && (
            <div
              style={{
                padding: '16px',
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
                borderTop: 'none',
                borderRadius: '0 0 14px 14px',
                marginTop: -1,
              }}
            >
              {([1, 2, 3, 4, 5] as const).map((i) => (
                <div key={i} style={{ marginBottom: i < 5 ? 16 : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: colors.text1, marginBottom: 4 }}>
                    {t(`profile.terms${i}Title`)}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.text2,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {t(`profile.terms${i}Body`)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            color: colors.text1,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <LogOut size={18} strokeWidth={2} />
          {t('profile.signOut')}
        </button>
      </section>
    </>
  );
}
