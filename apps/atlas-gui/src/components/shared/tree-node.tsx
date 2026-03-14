'use client';

import { ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import { cn, formatSize } from '@/lib/utils';
import { VisibilityBadge } from './visibility-badge';

export interface TreeNodeData {
  id: string;
  name: string;
  type: 'folder' | 'item';
  size?: number;
  itemCount?: number;
  totalSize?: number;
  isPublic?: boolean;
  publicPermission?: 'view' | 'edit' | 'full';
  isExpanded?: boolean;
  isSelected?: boolean;
  isLoading?: boolean;
  depth: number;
}

interface TreeNodeProps {
  node: TreeNodeData;
  onToggle?: () => void;
  onClick?: () => void;
}

const MAX_DEPTH = 5;

export function TreeNode({ node, onToggle, onClick }: TreeNodeProps) {
  const indent = Math.min(node.depth, MAX_DEPTH) * 16;
  const isFolder = node.type === 'folder';

  return (
    <div
      className={cn(
        'group flex items-center gap-1 py-1 px-2 text-xs cursor-pointer hover:bg-accent/50 transition-colors',
        node.isSelected && 'bg-accent',
        isFolder && (node.isPublic ? 'border-l-2 border-info' : 'border-l-2 border-muted-foreground/30'),
        !isFolder && 'border-l-2 border-transparent',
      )}
      style={{ paddingLeft: `${indent + 8}px` }}
      onClick={onClick}
    >
      {isFolder && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
        >
          {node.isLoading ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
          ) : node.isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      )}
      {!isFolder && <span className="w-4 shrink-0" />}

      {isFolder ? (
        <Folder className="h-3.5 w-3.5 shrink-0 text-warning" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}

      <span className="truncate flex-1 min-w-0">{node.name}</span>

      {isFolder && node.isPublic && (
        <VisibilityBadge isPublic permission={node.publicPermission} size="sm" showLabel={false} />
      )}

      <span className="shrink-0 text-[11px] text-muted-foreground ml-auto pl-2">
        {isFolder
          ? `${node.itemCount ?? 0} · ${formatSize(node.totalSize ?? 0)}`
          : formatSize(node.size ?? 0)
        }
      </span>
    </div>
  );
}
