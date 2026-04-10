'use client';

import { X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { FileIcon } from './file-icon';
import { formatSize } from '@/lib/utils';

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadQueueProps {
  items: UploadItem[];
  onRemove: (id: string) => void;
}

export function UploadQueue({ items, onRemove }: UploadQueueProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Upload Queue ({items.length})</h3>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-3">
          <FileIcon mimeType={item.file.type || 'application/octet-stream'} className="text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(item.file.size)}</p>
            {item.status === 'uploading' && (
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            )}
            {item.error && <p className="text-xs text-destructive mt-0.5">{item.error}</p>}
          </div>
          <div className="flex items-center gap-1">
            {item.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {item.status === 'done' && <Check className="h-4 w-4 text-success" />}
            {item.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
            {(item.status === 'pending' || item.status === 'error') && (
              <button onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
