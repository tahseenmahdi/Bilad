'use client';

import { useEffect, useState } from 'react';

// Keep category links compatible with the site's static export.
export function useCategoryHash<T extends string>(categories: readonly { id: T }[], initial: T) {
  const [category, setCategory] = useState<T>(initial);
  useEffect(() => {
    const sync = () => {
      const match = categories.find(item => `#${item.id}` === window.location.hash);
      if (match) setCategory(match.id);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [categories]);
  function choose(next: T) {
    setCategory(next);
    window.history.replaceState(window.history.state, '', `#${next}`);
  }
  return [category, choose] as const;
}
