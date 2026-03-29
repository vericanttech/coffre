import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useTheme } from '@/context/ThemeContext';
import { useOverlayBack } from '@/context/BackHandlerContext';
import { BottomNav } from '@/layout/BottomNav';
import { Sidebar, SIDEBAR_WIDTH_PX } from '@/layout/Sidebar';
import { HomeScreen } from '@/screens/HomeScreen';
import { SearchScreen } from '@/screens/SearchScreen';
// import { AlertesScreen } from '@/screens/AlertesScreen'; // Commented out – TODO: turn into Insights
import { ProfileScreen } from '@/screens/ProfileScreen';
import { UploadModal } from '@/screens/UploadModal';
import { DocumentDetailScreen } from '@/screens/DocumentDetailScreen';
import type { VaultDocument } from '@/types/vault';

export function MainScaffold() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  useOfflineSync(user?.uid ?? null);
  const { colors } = useTheme();
  const [tab, setTab] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [searchInitialFilter, setSearchInitialFilter] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<VaultDocument | null>(null);

  useOverlayBack(uploadOpen, useCallback(() => setUploadOpen(false), []));
  useOverlayBack(!!selectedDoc, useCallback(() => setSelectedDoc(null), []));

  const openSearchWithFilter = (filter: string | null) => {
    setSearchInitialFilter(filter);
    setTab(1);
  };

  const BOTTOM_NAV_HEIGHT = 96;

  const mainStyle: React.CSSProperties = isDesktop
    ? { marginLeft: SIDEBAR_WIDTH_PX, minHeight: '100vh', padding: '24px 32px 32px' }
    : {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '16px 16px 24px',
        paddingBottom: BOTTOM_NAV_HEIGHT,
      };

  const scrollAreaStyle: React.CSSProperties = isDesktop
    ? {}
    : {
        flex: 1,
        minHeight: 0,
        overflowX: 'hidden',
        overflowY: tab === 0 ? 'hidden' : 'auto',
      };

  return (
    <div
      style={{
        minHeight: '100vh',
        ...(isDesktop ? {} : { height: '100dvh', display: 'flex', flexDirection: 'column' }),
        background: colors.bg,
      }}
    >
      {isDesktop && (
        <Sidebar
          currentTab={tab}
          onTabChange={setTab}
          onAdd={() => setUploadOpen(true)}
        />
      )}

      <main className="app-max" style={mainStyle}>
        {isDesktop ? (
          <>
            {tab === 0 && (
              <HomeScreen
                onOpenSearch={openSearchWithFilter}
                onOpenProfile={!isDesktop ? () => setTab(3) : undefined}
              />
            )}
            {tab === 1 && (
              <SearchScreen
                initialFilter={searchInitialFilter}
                onClearInitialFilter={() => setSearchInitialFilter(null)}
                onOpenDocument={setSelectedDoc}
              />
            )}
            {/* tab 2 (Alerts) commented out – TODO: turn into Insights */}
            {/* {tab === 2 && <AlertesScreen onOpenDocument={setSelectedDoc} />} */}
            {tab === 3 && <ProfileScreen onBackToHome={!isDesktop ? () => setTab(0) : undefined} />}
          </>
        ) : (
          <div style={scrollAreaStyle}>
            {tab === 0 && (
              <HomeScreen
                onOpenSearch={openSearchWithFilter}
                onOpenProfile={() => setTab(3)}
              />
            )}
            {tab === 1 && (
              <SearchScreen
                initialFilter={searchInitialFilter}
                onClearInitialFilter={() => setSearchInitialFilter(null)}
                onOpenDocument={setSelectedDoc}
              />
            )}
            {/* tab 2 (Alerts) commented out – TODO: turn into Insights */}
            {/* {tab === 2 && <AlertesScreen onOpenDocument={setSelectedDoc} />} */}
            {tab === 3 && <ProfileScreen onBackToHome={() => setTab(0)} />}
          </div>
        )}
      </main>

      {!isDesktop && (
        <BottomNav
          currentTab={tab}
          onTabChange={setTab}
          onFAB={() => setUploadOpen(true)}
        />
      )}

      {uploadOpen && (
        <UploadModal
          userId={user!.uid}
          onClose={() => window.history.back()}
        />
      )}

      {selectedDoc && user && (
        <DocumentDetailScreen
          doc={selectedDoc}
          userId={user.uid}
          onClose={() => window.history.back()}
          isDesktop={isDesktop}
        />
      )}
    </div>
  );
}
