// Work page (Notion-like to-do page) — pure helpers shared by server actions, queries and client UI.
// Framework-free: no DB / React imports.

/** Tiptap JSON node (subset we store). */
export interface WorkPageNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: WorkPageNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export type WorkPageDoc = WorkPageNode & { type: 'doc' };

export const EMPTY_DOC: WorkPageDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

export const FILE_REQUIREMENTS = ['none', 'optional', 'required'] as const;
export type FileRequirement = (typeof FILE_REQUIREMENTS)[number];

export const FILE_REQUIREMENT_LABEL: Record<FileRequirement, string> = {
  none: 'ไม่ต้องแนบไฟล์',
  optional: 'แนบไฟล์ได้ (ไม่บังคับ)',
  required: 'ต้องแนบไฟล์อย่างน้อย 1 ไฟล์',
};
