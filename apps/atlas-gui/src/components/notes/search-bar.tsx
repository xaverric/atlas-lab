'use client';

import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  onSearch: (query: string, semantic: boolean) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [semantic, setSemantic] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim(), semantic);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={semantic ? 'Semantic search...' : 'Search notes...'}
          className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={() => setSemantic(!semantic)}
        title={semantic ? 'Semantic search (AI)' : 'Text search'}
        className={cn(
          'rounded-md border p-2 transition-colors',
          semantic ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent',
        )}
      >
        <Sparkles className="h-4 w-4" />
      </button>
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Search
      </button>
    </form>
  );
}
