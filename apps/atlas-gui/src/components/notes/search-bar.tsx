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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-[11px] bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 py-2">
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
          'shrink-0 rounded-lg p-1.5 transition-colors',
          semantic ? 'bg-[#0071e3]/10 text-[#0071e3]' : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-foreground',
        )}
      >
        <Sparkles className="h-4 w-4" />
      </button>
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-[#0071e3] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Search
      </button>
    </form>
  );
}
