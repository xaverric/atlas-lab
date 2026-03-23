'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Modal } from '@/components/shared/modal';

interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
}

export function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  description,
  defaultValue = '',
  placeholder,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [open, defaultValue]);

  const handleSubmit = () => onSubmit(value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-[420px]"
      footer={
        <>
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            OK
          </button>
        </>
      }
    >
      {description && <p className="mb-3 text-sm text-muted-foreground">{description}</p>}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        autoFocus
      />
    </Modal>
  );
}

type PromptOptions = {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
};

export function usePromptDialog() {
  const [state, setState] = useState<(PromptOptions & { open: boolean }) | null>(null);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const handleClose = useCallback(() => {
    setState(null);
    resolveRef.current?.(null);
    resolveRef.current = null;
  }, []);

  const handleSubmit = useCallback((value: string) => {
    setState(null);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const PromptDialogElement = state?.open ? (
    <PromptDialog
      open
      onClose={handleClose}
      onSubmit={handleSubmit}
      title={state.title}
      description={state.description}
      defaultValue={state.defaultValue}
      placeholder={state.placeholder}
    />
  ) : null;

  return { prompt, PromptDialogElement };
}
