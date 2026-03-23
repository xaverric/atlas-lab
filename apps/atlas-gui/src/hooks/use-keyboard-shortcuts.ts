'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const tag = (e.target as HTMLElement)?.tagName;
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      if (editable && e.key !== 'k') return;

      if (e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('[data-panel-search]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      if (e.key === 'n') {
        e.preventDefault();
        if (pathname.startsWith('/notes')) router.push('/notes/new');
        else if (pathname.startsWith('/scheduler')) router.push('/scheduler/jobs/new');
        else if (pathname.startsWith('/tracker')) router.push('/tracker/new');
        else if (pathname.startsWith('/files')) router.push('/files/upload');
      }

      if (e.key === '/') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('toggle-shortcuts-help'));
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [router, pathname]);
}
