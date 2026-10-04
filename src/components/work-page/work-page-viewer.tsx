'use client';

import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { cn } from 'cn';
import { workPageExtensions } from '@/lib/work-page-extensions';
import { EMPTY_DOC, type WorkPageDoc } from '@/lib/work-page';

/**
 * Read-only rendering of a work page JSON doc (history, teacher views, conflict draft box).
 * Rendered only through Tiptap (never as raw HTML).
 */
export function WorkPageViewer({ content, className }: { content: WorkPageDoc | null | undefined; className?: string }) {
  const [extensions] = useState(() => workPageExtensions({ placeholder: '' }));
  const doc = content && content.type === 'doc' ? content : EMPTY_DOC;

  const editor = useEditor({
    extensions,
    content: doc,
    editable: false,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setContent(doc, { emitUpdate: false });
  }, [editor, doc]);

  return (
    <div className={cn('work-page work-page--readonly', className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
