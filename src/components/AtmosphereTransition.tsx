'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const NavigationContext = createContext<(href: string) => void>(() => {});

export function AtmosphereTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLeaving(false);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [pathname]);

  function navigate(href: string) {
    if (leaving) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      router.push(href);
      return;
    }
    setLeaving(true);
    timer.current = setTimeout(() => router.push(href), 420);
  }

  return (
    <NavigationContext.Provider value={navigate}>
      <div className={`route-shell${leaving ? ' is-leaving' : ''}`}>
        {children}
        <div className="route-veil" aria-hidden="true" />
      </div>
    </NavigationContext.Provider>
  );
}

export function AtmosphereLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const navigate = useContext(NavigationContext);
  return <Link href={href} className={className} onNavigate={event => { event.preventDefault(); navigate(href); }}>{children}</Link>;
}
