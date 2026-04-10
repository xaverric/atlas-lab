import { FolderOpen, Search, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

const presets = {
  'no-documents': {
    icon: FolderOpen,
    title: 'No documents yet',
    description: 'Upload your first document to get started.',
    showUpload: true,
  },
  'no-results': {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filters.',
    showUpload: false,
  },
  'empty-folder': {
    icon: FolderOpen,
    title: 'This folder is empty',
    description: 'Upload files or create subfolders to organize your documents.',
    showUpload: true,
  },
} as const;

interface EmptyStateProps {
  preset?: keyof typeof presets;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  showUpload?: boolean;
}

export function EmptyState({ preset, icon, title, description, showUpload }: EmptyStateProps) {
  const p = preset ? presets[preset] : null;
  const Icon = icon || p?.icon || FolderOpen;
  const t = title || p?.title || 'Nothing here';
  const d = description || p?.description || '';
  const upload = showUpload ?? p?.showUpload ?? false;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-[rgba(0,0,0,0.2)] dark:text-[rgba(255,255,255,0.2)]" />
      <h3 className="mt-4 text-[17px] font-semibold">{t}</h3>
      <p className="mt-1 text-sm text-[rgba(0,0,0,0.48)] dark:text-[rgba(255,255,255,0.48)]">{d}</p>
      {upload && (
        <Link
          href="/files/upload"
          className="mt-4 flex items-center gap-2 rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Link>
      )}
    </div>
  );
}
