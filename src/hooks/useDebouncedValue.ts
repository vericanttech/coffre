import { useState, useEffect } from 'react';

/**
 * Returns a value that updates only after `delayMs` has passed without the input changing.
 * Useful for search: input stays responsive while filtering/API runs on the debounced value.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
