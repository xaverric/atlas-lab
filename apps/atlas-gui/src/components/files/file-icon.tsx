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

export const canPreview = (mimeType: string): boolean =>
  /^image\/|^video\/|^text\/|pdf/.test(mimeType) &&
  !/zip|rar|tar|gz|7z|archive|compressed|octet|msword|wordprocessing|docx/.test(mimeType);

interface FileIconProps {
  mimeType: string;
  className?: string;
}

export function FileIcon({ mimeType, className }: FileIconProps) {
  const Icon = getIcon(mimeType);
  return <Icon className={cn('h-4 w-4', className)} />;
}
