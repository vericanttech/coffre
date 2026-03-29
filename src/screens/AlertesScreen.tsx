/**
 * Alerts screen – commented out for now. TODO: turn into Insights.
 * Nav entry and related queries are disabled in MainScaffold, BottomNav, Sidebar.
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
// import { useDocuments } from '@/hooks/useDocuments'; // Commented out – no query while Alerts is disabled
import { useTheme } from '@/context/ThemeContext';
// import { VaultDocumentCard } from '@/components/VaultDocumentCard'; // Commented out with Alerts
import type { VaultDocument } from '@/types/vault';

interface AlertesScreenProps {
  onOpenDocument?: (doc: VaultDocument) => void;
}

// Query logic commented out – TODO: turn into Insights
// function expiringWithin60Days(d: VaultDocument): boolean {
//   const exp = d.extractedFields?.expiryDate;
//   if (!exp) return false;
//   const date = new Date(exp);
//   const in60 = new Date();
//   in60.setDate(in60.getDate() + 60);
//   return date <= in60 && date >= new Date();
// }

export function AlertesScreen(_props: AlertesScreenProps) {
  useScreenAnalytics('Alertes');
  const { t } = useTranslation();
  useAuth(); // user reserved for when Alerts/Insights query is re-enabled
  const { colors } = useTheme();
  // Related queries commented out – TODO: turn into Insights
  // const docs = useDocuments(user?.uid ?? null);
  // const expiring = docs.filter(expiringWithin60Days);

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>{t('alerts.title')}</h1>
      <div
        style={{
          padding: 32,
          background: colors.surface,
          borderRadius: 16,
          textAlign: 'center',
          color: colors.text2,
          fontSize: 14,
        }}
      >
        {t('alerts.none')}
      </div>
      {/* Expiring list and useDocuments query commented out – TODO: turn into Insights */}
      {/* {expiring.length === 0 ? ( ... ) : ( expiring.map(...) )} */}
    </>
  );
}
