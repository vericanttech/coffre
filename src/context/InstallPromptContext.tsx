import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/** Non-standard; not in DOM lib. We only need prompt() and userChoice. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'trouvedoc-install-banner-dismissed';

interface InstallPromptContextValue {
  /** True when the browser has fired beforeinstallprompt and we can show install UI */
  canInstall: boolean;
  /** True when running as installed PWA (standalone) */
  isInstalled: boolean;
  /** Call to show the native install prompt. No-op if canInstall is false. */
  promptInstall: () => Promise<void>;
  /** User dismissed the banner; we remember so we don't show it again */
  dismissBanner: () => void;
  /** Whether we should show the banner (canInstall && !isInstalled && !dismissed) */
  showBanner: boolean;
}

const InstallPromptContext = createContext<InstallPromptContextValue | null>(null);

export function InstallPromptProvider({ children }: { children: React.ReactNode }) {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true
      || document.referrer.includes('android-app://');
  });

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setIsInstalled(true);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    setEvent(null);
  }, [event]);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const canInstall = event != null;
  const showBanner = canInstall && !isInstalled && !dismissed;

  const value: InstallPromptContextValue = {
    canInstall,
    isInstalled,
    promptInstall,
    dismissBanner,
    showBanner,
  };

  return (
    <InstallPromptContext.Provider value={value}>
      {children}
    </InstallPromptContext.Provider>
  );
}

export function useInstallPrompt(): InstallPromptContextValue | null {
  return useContext(InstallPromptContext);
}
