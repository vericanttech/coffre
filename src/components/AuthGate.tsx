import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { SignInScreen } from '@/screens/SignInScreen';
import { MainScaffold } from '@/layout/MainScaffold';

export function AuthGate() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0F18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#9A9DB8' }}>{t('authGate.loading')}</span>
      </div>
    );
  }

  if (!user) return <SignInScreen />;
  return <MainScaffold />;
}
