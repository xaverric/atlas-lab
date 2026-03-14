'use client';

import { useEffect, useState, useCallback } from 'react';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreeNode, type TreeNodeData } from './tree-node';

export interface TreeItem {
  id: string;
  name: string;
  type: 'folder' | 'item';
  size?: number;
  itemCount?: number;
  totalSize?: number;
  isPublic?: boolean;
  publicPermission?: 'view' | 'edit' | 'full';
}

interface TreeSidebarProps {
  storageKey: string;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectItem: (id: string) => void;
  loadChildren: (parentId: string | null) => Promise<TreeItem[]>;
  title: string;
}

interface TreeState {
  [parentKey: string]: {
    children: TreeItem[];
    expanded: boolean;
    loaded: boolean;
    loading: boolean;
    error: boolean;
  };
}

const STORAGE_PREFIX = 'tree-expanded-';

export function TreeSidebar({ storageKey, selectedFolderId, onSelectFolder, onSelectItem, loadChildren, title }: TreeSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [tree, setTree] = useState<TreeState>({});

  useEffect(() => {
    const stored = localStorage.getItem(`${storageKey}-sidebar-open`);
    if (stored !== null) setIsOpen(stored === 'true');
  }, [storageKey]);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem(`${storageKey}-sidebar-open`, String(next));
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (stored) {
        const expandedIds: string[] = JSON.parse(stored);
        setTree((prev) => {
          const next = { ...prev };
          expandedIds.forEach((id) => {
            if (next[id]) next[id] = { ...next[id], expanded: true };
          });
          return next;
        });
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  const persistExpanded = useCallback((state: TreeState) => {
    const expandedIds = Object.entries(state)
      .filter(([, v]) => v.expanded)
      .map(([k]) => k);
    localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(expandedIds));
  }, [storageKey]);

  useEffect(() => {
    const loadRoot = async () => {
      setTree((prev) => ({ ...prev, root: { children: [], expanded: true, loaded: false, loading: true, error: false } }));
      try {
        const items = await loadChildren(null);
        setTree((prev) => ({ ...prev, root: { children: items, expanded: true, loaded: true, loading: false, error: false } }));
      } catch {
        setTree((prev) => ({ ...prev, root: { children: [], expanded: true, loaded: true, loading: false, error: true } }));
      }
    };
    loadRoot();
  }, [loadChildren]);

  const toggleFolder = async (folderId: string) => {
    const entry = tree[folderId];
    if (entry?.expanded) {
      setTree((prev) => {
        const next = { ...prev, [folderId]: { ...prev[folderId], expanded: false } };
        persistExpanded(next);
        return next;
      });
      return;
    }

    if (entry?.loaded) {
      setTree((prev) => {
        const next = { ...prev, [folderId]: { ...prev[folderId], expanded: true } };
        persistExpanded(next);
        return next;
      });
      return;
    }

    setTree((prev) => ({
      ...prev,
      [folderId]: { children: [], expanded: true, loaded: false, loading: true, error: false },
    }));

    try {
      const items = await loadChildren(folderId);
      setTree((prev) => {
        const next = {
          ...prev,
          [folderId]: { children: items, expanded: true, loaded: true, loading: false, error: false },
        };
        persistExpanded(next);
        return next;
      });
    } catch {
      setTree((prev) => ({
        ...prev,
        [folderId]: { children: [], expanded: true, loaded: true, loading: false, error: true },
      }));
    }
  };

  const retryLoad = (folderId: string | null) => {
    const key = folderId ?? 'root';
    setTree((prev) => ({ ...prev, [key]: { ...prev[key], loading: true, error: false } }));
    loadChildren(folderId).then((items) => {
      setTree((prev) => ({
        ...prev,
        [key]: { children: items, expanded: true, loaded: true, loading: false, error: false },
      }));
    }).catch(() => {
      setTree((prev) => ({
        ...prev,
        [key]: { ...prev[key], loading: false, error: true },
      }));
    });
  };

  const renderChildren = (parentKey: string, depth: number) => {
    const entry = tree[parentKey];
    if (!entry || !entry.expanded) return null;

    if (entry.loading) {
      return (
        <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1 text-[10px] text-muted-foreground animate-pulse">
          Loading...
        </div>
      );
    }

    if (entry.error) {
      return (
        <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1 text-[10px] text-destructive flex items-center gap-1">
          Failed to load
          <button onClick={() => retryLoad(parentKey === 'root' ? null : parentKey)} className="underline hover:no-underline">
            retry
          </button>
        </div>
      );
    }

    const folders = entry.children.filter((c) => c.type === 'folder');
    const items = entry.children.filter((c) => c.type === 'item');

    return (
      <>
        {folders.map((child) => {
          const childEntry = tree[child.id];
          const nodeData: TreeNodeData = {
            ...child,
            depth: depth + 1,
            isExpanded: childEntry?.expanded ?? false,
            isSelected: child.id === selectedFolderId,
            isLoading: childEntry?.loading ?? false,
          };
          return (
            <div key={child.id}>
              <TreeNode
                node={nodeData}
                onToggle={() => toggleFolder(child.id)}
                onClick={() => onSelectFolder(child.id)}
              />
              {renderChildren(child.id, depth + 1)}
            </div>
          );
        })}
        {items.map((item) => {
          const nodeData: TreeNodeData = {
            ...item,
            depth: depth + 1,
            isExpanded: false,
            isSelected: false,
            isLoading: false,
          };
          return (
            <TreeNode
              key={item.id}
              node={nodeData}
              onClick={() => onSelectItem(item.id)}
            />
          );
        })}
      </>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="shrink-0 p-2 border-r hover:bg-accent transition-colors"
        title="Open explorer"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="shrink-0 w-60 border-r flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        <button onClick={toggleOpen} className="p-1 text-muted-foreground hover:text-foreground rounded">
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-[11px] cursor-pointer hover:bg-accent/50 transition-colors',
            selectedFolderId === null && 'bg-accent font-medium',
          )}
          onClick={() => onSelectFolder(null)}
        >
          All {title === 'Explorer' ? 'Items' : title}
        </div>
        {renderChildren('root', -1)}
      </div>
    </div>
  );
}
