'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Reset the document scroll position after every page navigation. */
export function ScrollToTop() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;

    // The site uses smooth scrolling globally; disable it for this reset so the
    // destination page is painted at the top instead of visibly travelling up.
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previousScrollBehavior;
  }, [pathname]);

  return null;
}
