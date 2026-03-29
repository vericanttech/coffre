import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'useCompactView';
const EVENT_NAME = 'trouvedoc-compact-view-change';

function getStored(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Global compact list mode: persisted in localStorage, synced across Profile and Search. */
export function useCompactView(): [boolean, (value: boolean) => void] {
  const [value, setValueState] = useState(getStored);

  const setValue = useCallback((v: boolean) => {
    setValueState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch {}
  }, []);

  useEffect(() => {
    const handler = () => setValueState(getStored());
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  return [value, setValue];
}
