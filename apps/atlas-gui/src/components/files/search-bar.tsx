'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Filters {
  search: string;
  mimeType: string;
  dateFrom: string;
  dateTo: string;
  tags: string[];
}

interface SearchBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  availableTags: string[];
  className?: string;
}

const mimeOptions = [
  { label: 'All types', value: '' },
  { label: 'Images', value: 'image/' },
  { label: 'PDFs', value: 'pdf' },
  { label: 'Documents', value: 'text/' },
  { label: 'Videos', value: 'video/' },
  { label: 'Audio', value: 'audio/' },
  { label: 'Archives', value: 'zip' },
];

export function SearchBar({ filters, onChange, availableTags, className }: SearchBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  const debounceSearch = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (value: string) => {
        clearTimeout(timer);
        timer = setTimeout(() => onChange({ ...filters, search: value }), 300);
      };
    })(),
    [filters, onChange],
  );

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    debounceSearch(value);
  };

  const set = (key: keyof Filters, value: string | string[]) =>
    onChange({ ...filters, [key]: value });

  const hasFilters = filters.mimeType || filters.dateFrom || filters.dateTo || filters.tags.length > 0;

  const clearAll = () =>
    onChange({ search: '', mimeType: '', dateFrom: '', dateTo: '', tags: [] });

  const activeFilterCount = [filters.mimeType, filters.dateFrom, filters.dateTo].filter(Boolean).length + (filters.tags.length > 0 ? 1 : 0);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1 flex items-center gap-2 rounded-[11px] bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          {localSearch && (
            <button
              onClick={() => handleSearchChange('')}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters((p) => !p)}
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm md:hidden',
            showFilters && 'bg-[#f5f5f7] dark:bg-[#1c1c1e]',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="hidden md:contents">
          <select
            value={filters.mimeType}
            onChange={(e) => set('mimeType', e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {mimeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set('dateFrom', e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set('dateTo', e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />

          {hasFilters && (
            <button
              onClick={clearAll}
              className="rounded-md border border-input px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 gap-2 rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-3 md:hidden">
          <select
            value={filters.mimeType}
            onChange={(e) => set('mimeType', e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {mimeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set('dateFrom', e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set('dateTo', e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="rounded-md border border-input px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 overflow-x-auto">
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                const next = filters.tags.includes(tag)
                  ? filters.tags.filter((t) => t !== tag)
                  : [...filters.tags, tag];
                set('tags', next);
              }}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                filters.tags.includes(tag)
                  ? 'bg-[#0071e3]/10 text-[#0071e3]'
                  : 'border-input text-muted-foreground hover:text-foreground',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
