import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const OfflineContext = createContext<boolean>(false);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return <OfflineContext.Provider value={offline}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  return useContext(OfflineContext);
}
