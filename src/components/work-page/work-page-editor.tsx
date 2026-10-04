'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { cn } from 'cn';
import { workPageExtensions } from '@/lib/work-page-extensions';
import { EMPTY_DOC, type WorkPageDoc } from '@/lib/work-page';
import { WorkPageToolbar } from './work-page-toolbar';

interface WorkPageEditorProps {
  initialContent: WorkPageDoc | null;
  editable: boolean;
  onChange?: (doc: WorkPageDoc) => void;
  onBlur?: () => void;
  onReady?: (editor: Editor) => void;
  className?: string;
}

/**
 * Tiptap editor for the work page. `initialContent` is read once (later changes go through
 * editor commands, e.g. on a save conflict) so server re-renders never reset what the user types.
 */
export function WorkPageEditor({ initialContent, editable, onChange, onBlur, onReady, className }: WorkPageEditorProps) {
  const [extensions] = useState(() => workPageExtensions());
  const [content] = useState<WorkPageDoc>(() =>
    initialContent && initialContent.type === 'doc' ? initialContent : EMPTY_DOC,
  );
  const callbacks = useRef({ onChange, onBlur });
  useEffect(() => {
    callbacks.current = { onChange, onBlur };
  });

  const editor = useEditor({
    extensions,
    content,
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { 'aria-label': 'หน้างาน', class: 'tiptap-root' },
    },
    onUpdate: ({ editor: e }) => callbacks.current.onChange?.(e.getJSON() as WorkPageDoc),
    onBlur: () => callbacks.current.onBlur?.(),
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  useEffect(() => {
    if (editor) onReady?.(editor);
    // onReady is only meaningful once per editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div className={cn('work-page', !editable && 'work-page--readonly', className)}>
      {editable && editor && <WorkPageToolbar editor={editor} />}
      {!editor && <div className="tiptap-skeleton" aria-hidden />}
      <EditorContent editor={editor} />
    </div>
  );
}
