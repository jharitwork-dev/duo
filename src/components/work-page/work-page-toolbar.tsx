'use client';

import { useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Bold, Heading2, Italic, Link2, List, ListChecks } from 'lucide-react';
import { cn } from 'cn';
import { isSafeLinkHref } from '@/lib/work-page';

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      // Keep the editor selection when tapping a toolbar button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-[10px] text-cocoon-subtle outline-none transition-colors hover:bg-cocoon-blue-soft focus-visible:ring-2 focus-visible:ring-cocoon-blue/40',
        active && 'bg-cocoon-blue-soft text-cocoon-blue',
      )}
    >
      {children}
    </button>
  );
}

/** Normalises user input to an absolute URL ("example.com" → "https://example.com"). */
function normaliseHref(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (value.includes('@') && !value.includes('/')) return `mailto:${value}`;
  return `https://${value}`;
}

/**
 * Small formatting toolbar (H, B, I, bullet list, to-do list, link). Sticks to the top of the
 * card on mobile and scrolls horizontally when narrow.
 */
export function WorkPageToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      heading: e.isActive('heading', { level: 2 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      bullet: e.isActive('bulletList'),
      task: e.isActive('taskList'),
      link: e.isActive('link'),
      href: (e.getAttributes('link').href as string | undefined) ?? '',
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  function openLink() {
    setLinkValue(state.href);
    setLinkError(null);
    setLinkOpen((v) => !v);
  }

  function applyLink() {
    const href = normaliseHref(linkValue);
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!isSafeLinkHref(href)) {
      setLinkError('ลิงก์ต้องขึ้นต้นด้วย http://, https:// หรือ mailto:');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLinkOpen(false);
  }

  return (
    <div className="sticky top-0 z-10 -mx-5 border-b border-[#f1ece5] bg-white px-3 lg:static lg:mx-0 lg:rounded-[12px] lg:border lg:px-2">
      <div role="toolbar" aria-label="จัดรูปแบบข้อความ" className="flex gap-1 overflow-x-auto py-1">
        <ToolButton
          label="หัวข้อ"
          active={state.heading}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-5" aria-hidden />
        </ToolButton>
        <ToolButton label="ตัวหนา" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-5" aria-hidden />
        </ToolButton>
        <ToolButton label="ตัวเอียง" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-5" aria-hidden />
        </ToolButton>
        <ToolButton
          label="รายการแบบจุด"
          active={state.bullet}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-5" aria-hidden />
        </ToolButton>
        <ToolButton
          label="รายการ to-do"
          active={state.task}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListChecks className="size-5" aria-hidden />
        </ToolButton>
        <ToolButton label="ลิงก์" active={state.link || linkOpen} onClick={openLink}>
          <Link2 className="size-5" aria-hidden />
        </ToolButton>
      </div>

      {linkOpen && (
        <form
          className="flex flex-wrap items-center gap-2 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            type="text"
            inputMode="url"
            autoFocus
            value={linkValue}
            onChange={(e) => {
              setLinkValue(e.target.value);
              setLinkError(null);
            }}
            placeholder="https://"
            aria-label="ที่อยู่ลิงก์"
            className="h-10 min-w-0 flex-1 rounded-[10px] border border-[#f1ece5] bg-[#fffaf3] px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
          />
          <button
            type="submit"
            className="h-10 rounded-[10px] bg-cocoon-blue px-4 text-[14px] font-bold text-white"
          >
            ใส่ลิงก์
          </button>
          {state.link && (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                setLinkOpen(false);
              }}
              className="h-10 rounded-[10px] border border-cocoon-line px-3 text-[14px] font-bold text-cocoon-subtle"
            >
              เอาลิงก์ออก
            </button>
          )}
          {linkError && <p className="w-full text-[12px] font-medium text-cocoon-orange">{linkError}</p>}
        </form>
      )}
    </div>
  );
}
