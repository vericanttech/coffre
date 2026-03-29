import { useEffect } from 'react';
import { logScreenView } from '@/lib/analytics';

export function useScreenAnalytics(screenName: string) {
  useEffect(() => {
    logScreenView(screenName);
  }, [screenName]);
}
