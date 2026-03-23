'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import LinkExt from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { EditorToolbar } from './editor-toolbar';
import { AttachmentImage } from './attachment-image-node';

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  isMarkdown?: boolean;
  onToggleMarkdown?: () => void;
  onInsertImage?: () => void;
  children?: React.ReactNode;
}

export function TiptapEditor({ content, onChange, placeholder = 'Start writing...', isMarkdown, onToggleMarkdown, onInsertImage, children }: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder }),
      LinkExt.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      AttachmentImage,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[300px] px-0 py-4 focus:outline-none',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Tab') {
          if (editor?.can().sinkListItem('listItem')) {
            editor.chain().focus().sinkListItem('listItem').run();
            return true;
          }
          if (editor?.can().sinkListItem('taskItem')) {
            editor.chain().focus().sinkListItem('taskItem').run();
            return true;
          }
        }
        if (event.key === 'Tab' && event.shiftKey) {
          if (editor?.can().liftListItem('listItem')) {
            editor.chain().focus().liftListItem('listItem').run();
            return true;
          }
          if (editor?.can().liftListItem('taskItem')) {
            editor.chain().focus().liftListItem('taskItem').run();
            return true;
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const currentHtml = editor.getHTML();
      if (currentHtml !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [editor, content]);

  return (
    <div>
      <div className="sticky top-0 z-10 border-b bg-background/92 backdrop-blur-sm">
        <EditorToolbar
          editor={editor}
          isMarkdown={isMarkdown}
          onToggleMarkdown={onToggleMarkdown}
          onInsertImage={onInsertImage}
        />
      </div>
      {isMarkdown && children ? children : <EditorContent editor={editor} />}
    </div>
  );
}

export { type TiptapEditorProps };
