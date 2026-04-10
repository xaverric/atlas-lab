'use client';

import { useState, useCallback, useRef } from 'react';
import { Modal } from '@/components/shared/modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  const confirmBtnClass =
    variant === 'destructive'
      ? 'rounded-lg bg-[#ff3b30] px-4 py-2 text-sm font-medium text-white hover:opacity-90'
      : 'rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-medium text-white hover:opacity-90';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-[420px]"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg bg-[#f5f5f7] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#e8e8ed] dark:bg-[#2c2c2e] dark:text-white dark:hover:bg-[#3a3a3c]">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={confirmBtnClass}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </Modal>
  );
}

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
};

export function useConfirmDialog() {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const handleClose = useCallback(() => {
    setState(null);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => {
    setState(null);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const ConfirmDialogElement = state?.open ? (
    <ConfirmDialog
      open
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
    />
  ) : null;

  return { confirm, ConfirmDialogElement };
}
