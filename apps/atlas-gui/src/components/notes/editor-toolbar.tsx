'use client';

import type { Editor } from '@tiptap/react';
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, CodeSquare, Link, Image as ImageIcon, Minus, Quote } from 'lucide-react';
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

  const buttons = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Bold' },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Italic' },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), title: 'Strikethrough' },
    { icon: Code, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), title: 'Code' },
    null,
    { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), title: 'Heading 1' },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), title: 'Heading 2' },
    { icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), title: 'Heading 3' },
    null,
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Bullet list' },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Ordered list' },
    { icon: ListChecks, action: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive('taskList'), title: 'Task list' },
    null,
    { icon: CodeSquare, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), title: 'Code block' },
    { icon: ImageIcon, action: () => onInsertImage?.(), label: 'Image', title: 'Image' },
    { icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run(), label: 'Divider', title: 'Divider' },
    { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), label: 'Quote', title: 'Quote' },
    null,
    { icon: Link, action: setLink, active: editor.isActive('link'), title: 'Link' },
  ];

  return (
    <>
      {PromptDialogElement}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
        {buttons.map((btn, i) => {
          if (!btn) return <div key={i} className="mx-1 h-6 w-px bg-border" />;
          const Icon = btn.icon;
          return (
            <button
              key={btn.title}
              type="button"
              onClick={btn.action}
              title={btn.title}
              className={cn(
                'rounded p-1.5 text-sm transition-colors hover:bg-accent',
                btn.active && 'bg-accent text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        {onToggleMarkdown && (
          <button
            onClick={onToggleMarkdown}
            className={cn('ml-auto rounded-md px-3 py-1 text-xs font-medium transition-colors', isMarkdown ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
          >
            {isMarkdown ? 'WYSIWYG' : 'Markdown'}
          </button>
        )}
      </div>
    </>
  );
}
