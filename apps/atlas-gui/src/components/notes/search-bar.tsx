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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={semantic ? 'Semantic search...' : 'Search notes...'}
        className="w-full bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={() => setSemantic(!semantic)}
        title={semantic ? 'Semantic search (AI)' : 'Text search'}
        className={cn(
          'shrink-0 rounded-md p-1.5 transition-colors',
          semantic ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Sparkles className="h-4 w-4" />
      </button>
      <button
        type="submit"
        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Search
      </button>
    </form>
  );
}
