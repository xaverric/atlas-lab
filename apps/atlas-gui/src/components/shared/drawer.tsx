'use client';

import { type ReactNode, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="4" x2="14" y2="14" />
      <line x1="14" y1="4" x2="4" y2="14" />
    </svg>
  );
}

export function Drawer({ open, onClose, title, children, width = 'w-[380px]' }: DrawerProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[199] bg-black/20" onClick={onClose} />
      )}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 z-[200] flex flex-col bg-white shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] transition-transform duration-200 dark:bg-[#1c1c1e]',
          width,
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[rgba(0,0,0,0.48)] transition-colors hover:bg-black/[0.04] hover:text-[#1d1d1f] dark:text-[rgba(255,255,255,0.48)] dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </>
  );
}
