'use client';

import type { Editor } from '@tiptap/react';
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, ListChecks, CodeSquare, Link, Image as ImageIcon, Minus, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePromptDialog } from '@/components/shared/prompt-dialog';

interface EditorToolbarProps {
  editor: Editor | null;
  isMarkdown?: boolean;
  onToggleMarkdown?: () => void;
  onInsertImage?: () => void;
}

export function EditorToolbar({ editor, isMarkdown, onToggleMarkdown, onInsertImage }: EditorToolbarProps) {
  const { prompt, PromptDialogElement } = usePromptDialog();

  if (!editor) return null;

  const setLink = async () => {
    const url = await prompt({ title: 'Insert link', placeholder: 'https://...' });
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  };

  type ToolbarButton = { icon?: typeof Bold; label?: string; action: () => void; active?: boolean; title: string } | null;

  const buttons: ToolbarButton[] = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Bold' },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Italic' },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), title: 'Strikethrough' },
    { icon: Code, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), title: 'Code' },
    null,
    { label: 'H1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), title: 'Heading 1' },
    { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), title: 'Heading 2' },
    { label: 'H3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), title: 'Heading 3' },
    null,
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Bullet list' },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Ordered list' },
    { icon: ListChecks, action: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive('taskList'), title: 'Task list' },
    null,
    { icon: CodeSquare, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), title: 'Code block' },
    { icon: ImageIcon, action: () => onInsertImage?.(), title: 'Image' },
    { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), title: 'Quote' },
    { icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run(), title: 'Divider' },
    { icon: Link, action: setLink, active: editor.isActive('link'), title: 'Link' },
  ];

  return (
    <>
      {PromptDialogElement}
      <div className="flex flex-wrap items-center gap-0.5 py-1.5">
        {buttons.map((btn, i) => {
          if (!btn) return <div key={i} className="mx-1.5 h-5 w-px bg-border" />;
          const Icon = btn.icon;
          return (
            <button
              key={btn.title}
              type="button"
              onClick={btn.action}
              title={btn.title}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent',
                btn.active && 'bg-accent text-primary',
              )}
            >
              {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs font-bold">{btn.label}</span>}
            </button>
          );
        })}
        {onToggleMarkdown && (
          <div className="ml-auto flex rounded-lg bg-muted p-0.5">
            <button
              onClick={isMarkdown ? onToggleMarkdown : undefined}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                !isMarkdown ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              WYSIWYG
            </button>
            <button
              onClick={!isMarkdown ? onToggleMarkdown : undefined}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                isMarkdown ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Markdown
            </button>
          </div>
        )}
      </div>
    </>
  );
}
