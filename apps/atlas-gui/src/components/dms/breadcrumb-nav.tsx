'use client';

import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export function BreadcrumbNav({ items, onNavigate }: BreadcrumbNavProps) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span>Root</span>
      </button>
      {items.map((item, i) => (
        <span key={item.id} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          {i === items.length - 1 ? (
            <span className="font-medium">{item.name}</span>
          ) : (
            <button
              onClick={() => onNavigate(item.id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
