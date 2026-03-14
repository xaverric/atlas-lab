'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Folder, FileText, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface FolderData {
  id: string;
  name: string;
  publicPermission?: string;
  breadcrumb?: { id: string; name: string }[];
}

interface SubfolderItem {
  id: string;
  name: string;
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
}

const publicApi = async <T = unknown>(path: string): Promise<T> => {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
};

export default function PublicNotesFolderPage() {
  const { id } = useParams<{ id: string }>();
  const [folder, setFolder] = useState<FolderData | null>(null);
  const [subfolders, setSubfolders] = useState<SubfolderItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadContents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await publicApi<{ data: { folder: FolderData; subfolders: SubfolderItem[]; notes: NoteItem[] } }>(
        `/public/folders/${id}/contents`
      );
      setFolder(res.data.folder);
      setSubfolders(res.data.subfolders);
      setNotes(res.data.notes);
    } catch {
      setError('Folder not found or is not public');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadContents(); }, [loadContents]);

  if (error) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="mx-auto max-w-5xl px-4 py-8 flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Not Found</h1>
            <p className="mt-2 text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !folder) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="mx-auto max-w-5xl px-4 py-8 flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const breadcrumb = folder.breadcrumb || [];

  return (
    <div className="min-h-screen bg-muted">
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-foreground">{folder.name}</h1>
        {breadcrumb.length > 0 && (
          <nav className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumb.map((b, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <span key={b.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  {isLast ? (
                    <span className="text-foreground">{b.name}</span>
                  ) : (
                    <Link href={`/public/notes/folders/${b.id}`} className="hover:text-foreground">
                      {b.name}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        )}
      </header>

      {subfolders.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Folders</h2>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {subfolders.map((sf) => (
              <Link
                key={sf.id}
                href={`/public/notes/folders/${sf.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent dark:border-border dark:bg-card"
              >
                <Folder className="h-5 w-5 text-warning shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{sf.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notes</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => {
              const excerpt = note.content
                .replace(/<[^>]*>/g, '')
                .replace(/[#*_~`]/g, '')
                .slice(0, 120);
              return (
                <Link
                  key={note.id}
                  href={`/public/notes/${note.id}`}
                  className="block rounded-lg border border-border bg-card p-4 hover:bg-accent dark:border-border dark:bg-card"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h3 className="font-medium text-foreground truncate">{note.title}</h3>
                  </div>
                  {excerpt && (
                    <p className="mb-2 text-sm text-muted-foreground line-clamp-2">{excerpt}</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {note.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-info/10 px-2 py-0.5 text-xs text-info">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(note.updatedAt)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {subfolders.length === 0 && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Folder className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-foreground">This folder is empty</h3>
        </div>
      )}

      <footer className="text-center text-xs text-muted-foreground dark:text-muted-foreground">
        Powered by Atlas Notes
      </footer>
    </div>
    </div>
  );
}
