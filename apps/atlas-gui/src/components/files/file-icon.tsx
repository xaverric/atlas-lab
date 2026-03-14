import {
  FileText, FileImage, FileVideo, FileAudio,
  File, FileArchive, FileCode, FileSpreadsheet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const mimeMap: [RegExp, LucideIcon][] = [
  [/^image\//, FileImage],
  [/^video\//, FileVideo],
  [/^audio\//, FileAudio],
  [/pdf/, FileText],
  [/spreadsheet|excel|csv/, FileSpreadsheet],
  [/zip|rar|tar|gz|7z|archive|compressed/, FileArchive],
  [/javascript|typescript|json|xml|html|css|code/, FileCode],
  [/text\//, FileText],
];

const getIcon = (mimeType: string): LucideIcon => {
  for (const [pattern, icon] of mimeMap) {
    if (pattern.test(mimeType)) return icon;
  }
  return File;
};

const TEXT_LIKE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java',
  'sh', 'bash', 'zsh', 'json', 'xml', 'yaml', 'yml', 'toml',
  'css', 'html', 'htm', 'svg', 'md', 'mdx', 'sql', 'graphql',
  'dockerfile', 'makefile', 'csv', 'tsv',
]);

export const canPreview = (mimeType: string, name?: string): boolean => {
  if (/zip|rar|tar|gz|7z|archive|compressed|octet|msword|wordprocessing|docx/.test(mimeType)) return false;
  if (/^image\/|^video\/|^audio\/|^text\/|pdf/.test(mimeType)) return true;
  if (/^application\/(json|javascript|xml|x-yaml|x-sh|x-python|typescript)$/.test(mimeType)) return true;
  if (name) {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (TEXT_LIKE_EXTENSIONS.has(ext)) return true;
  }
  return false;
};

interface FileIconProps {
  mimeType: string;
  className?: string;
}

export function FileIcon({ mimeType, className }: FileIconProps) {
  const Icon = getIcon(mimeType);
  return <Icon className={cn('h-4 w-4', className)} />;
}
