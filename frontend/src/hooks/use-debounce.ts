"use client";

import { useEffect, useState } from "react";

/**
 * Delays propagating `value` until it has been stable for `delay` ms.
 *
 * Used for the search input: typing fires onChange on every keystroke, but the
 * API call should only happen once the user pauses. 300 ms is the sweet spot —
 * fast enough to feel instant, slow enough to avoid a request per character.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
