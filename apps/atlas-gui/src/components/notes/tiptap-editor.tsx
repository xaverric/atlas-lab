'use client';

import { useEditor, EditorContent } from '@tiptap/react';
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
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[300px] p-4 focus:outline-none',
      },
    },
  });

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <EditorToolbar
        editor={editor}
        isMarkdown={isMarkdown}
        onToggleMarkdown={onToggleMarkdown}
        onInsertImage={onInsertImage}
      />
      {isMarkdown && children ? children : <EditorContent editor={editor} />}
    </div>
  );
}

export { type TiptapEditorProps };
