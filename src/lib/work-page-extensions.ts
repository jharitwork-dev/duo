// Tiptap v3 extension set for the student work page. Framework-free (no 'use client') so the
// editor, the read-only viewer and the schema-sync unit test all share exactly one definition.
//
// Verified against node_modules (@tiptap/* 3.31.4):
// - StarterKit v3 already bundles Link + Underline (+ ListKeymap, TrailingNode, Dropcursor, Gapcursor),
//   so the bundled Link is disabled and @tiptap/extension-link is registered once (no duplicate names).
// - TaskList / TaskItem re-export from @tiptap/extension-list; Placeholder from @tiptap/extensions.
// - TaskItem's input rule /^\s*(\[([( |x])?\])\s$/ already accepts "[] ", "[ ] " and "[x] ".
import { StarterKit } from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';

export const WORK_PAGE_PLACEHOLDER = 'พิมพ์รายละเอียดงาน หรือกด [ ] เพื่อสร้าง to-do';

export function workPageExtensions(opts?: { placeholder?: string }) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, codeBlock: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ['http', 'https', 'mailto'],
      defaultProtocol: 'https',
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    Placeholder.configure({ placeholder: opts?.placeholder ?? WORK_PAGE_PLACEHOLDER }),
  ];
}
