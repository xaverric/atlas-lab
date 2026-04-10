'use client';

import { Trash2, FolderInput, X } from 'lucide-react';
import { useState } from 'react';
import { MoveDialog } from './move-dialog';

interface BulkActionsBarProps {
  count: number;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
  onClear: () => void;
  currentFolderId: string | null;
}

export function BulkActionsBar({ count, onDelete, onMove, onClear, currentFolderId }: BulkActionsBarProps) {
  const [showMovePicker, setShowMovePicker] = useState(false);

  return (
    <>
      <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{count} selected</span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg bg-[#ff3b30]/10 px-3 py-1.5 text-sm text-[#ff3b30] hover:bg-[#ff3b30]/20"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            {currentFolderId && (
              <button
                onClick={() => onMove(null)}
                className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#2c2c2e] px-3 py-1.5 text-sm hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c]"
              >
                <FolderInput className="h-3.5 w-3.5" /> Move to Root
              </button>
            )}
            <button
              onClick={() => setShowMovePicker(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#2c2c2e] px-3 py-1.5 text-sm hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c]"
            >
              <FolderInput className="h-3.5 w-3.5" /> Move to...
            </button>
          </div>
          <button onClick={onClear} className="ml-auto text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showMovePicker && (
        <MoveDialog
          title={`Move ${count} document(s)`}
          currentFolderId={currentFolderId}
          onConfirm={onMove}
          onClose={() => setShowMovePicker(false)}
        />
      )}
    </>
  );
}
