import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

type BackHandler = () => void;

const BackHandlerContext = createContext<{
  /** Register a handler for the system/Android back. Call the returned function to unregister. */
  register: (handler: BackHandler) => () => void;
} | null>(null);

/**
 * When an overlay is open, register a back handler and push a history state
 * so that the Android system back (or browser back) closes the overlay instead of leaving the app.
 * Closing the overlay via UI should call history.back() so the same handler runs on popstate.
 */
export function BackHandlerProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<BackHandler[]>([]);

  const register = useCallback((handler: BackHandler) => {
    if (typeof window === 'undefined') return () => {};
    stackRef.current.push(handler);
    window.history.pushState({ backHandler: true }, '');
    return () => {
      const i = stackRef.current.indexOf(handler);
      if (i !== -1) stackRef.current.splice(i, 1);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const handler = stackRef.current.pop();
      if (handler) handler();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <BackHandlerContext.Provider value={{ register }}>
      {children}
    </BackHandlerContext.Provider>
  );
}

export function useBackHandler() {
  const ctx = useContext(BackHandlerContext);
  if (!ctx) throw new Error('useBackHandler must be used within BackHandlerProvider');
  return ctx;
}

/**
 * Call this when opening an overlay. When the user presses system back, onClose will be called.
 * From your UI close button, call history.back() so the same behaviour runs.
 */
export function useOverlayBack(open: boolean, onClose: () => void) {
  const { register } = useBackHandler();
  const unregisterRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) {
      unregisterRef.current?.();
      unregisterRef.current = null;
      return;
    }
    unregisterRef.current = register(onClose);
    return () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    };
  }, [open, onClose, register]);
}
