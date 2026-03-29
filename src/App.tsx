import { ThemeProvider } from '@/context/ThemeContext';
import { OfflineProvider } from '@/context/OfflineContext';
import { InstallPromptProvider } from '@/context/InstallPromptContext';
import { BackHandlerProvider } from '@/context/BackHandlerContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { InstallBanner } from '@/components/InstallBanner';
import { AuthGate } from '@/components/AuthGate';

export default function App() {
  return (
    <ThemeProvider>
      <OfflineProvider>
        <InstallPromptProvider>
          <BackHandlerProvider>
            <OfflineBanner />
            <InstallBanner />
            <AuthGate />
          </BackHandlerProvider>
        </InstallPromptProvider>
      </OfflineProvider>
    </ThemeProvider>
  );
}
