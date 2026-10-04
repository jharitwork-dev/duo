import { describe, it, expect } from 'vitest';
import { getSchema } from '@tiptap/core';
import {
  EMPTY_DOC,
  FILE_REQUIREMENTS,
  WORK_PAGE_MARK_TYPES,
  WORK_PAGE_NODE_TYPES,
  MAX_CONTENT_BYTES,
  canEditWorkPage,
  canSubmitWorkPage,
  checklistProgress,
  hasPageContent,
  isSaveConflict,
  plainTextFromDoc,
  validateWorkPageContent,
  workPageOwnerKey,
  type FileRequirement,
  type WorkPageDoc,
  type WorkPageNode,
} from '../work-page';
import { workPageExtensions } from '../work-page-extensions';
import type { SubmissionStatus } from '../node-path';

const p = (text?: string): WorkPageNode =>
  text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' };
const task = (text: string, checked: boolean, nested?: WorkPageNode): WorkPageNode => ({
  type: 'taskItem',
  attrs: { checked },
  content: [p(text), ...(nested ? [nested] : [])],
});
const doc = (...content: WorkPageNode[]): WorkPageDoc => ({ type: 'doc', content });

describe('checklistProgress', () => {
  it('is 0/0 for the empty doc', () => {
    expect(checklistProgress(EMPTY_DOC)).toEqual({ done: 0, total: 0 });
  });

  it('counts nested task items and ignores bullet list items', () => {
    const d = doc(
      {
        type: 'taskList',
        content: [
          task('a', true),
          task('b', false, { type: 'taskList', content: [task('b1', true)] }),
          task('c', true),
          task('d', false),
        ],
      },
      { type: 'bulletList', content: [{ type: 'listItem', content: [p('x')] }] },
    );
    expect(checklistProgress(d)).toEqual({ done: 3, total: 5 });
  });

  it('tolerates null / malformed input', () => {
    expect(checklistProgress(null)).toEqual({ done: 0, total: 0 });
    expect(checklistProgress({} as WorkPageDoc)).toEqual({ done: 0, total: 0 });
  });
});

describe('hasPageContent', () => {
  it('is false for empty docs', () => {
    expect(hasPageContent(EMPTY_DOC)).toBe(false);
    expect(hasPageContent(doc(p(), p()))).toBe(false);
    expect(hasPageContent(doc(p('   ')))).toBe(false);
    expect(hasPageContent(null)).toBe(false);
  });

  it('is true when any text exists', () => {
    expect(hasPageContent(doc(p('x')))).toBe(true);
  });

  it('an empty unchecked task item has no content; one with text does', () => {
    expect(hasPageContent(doc({ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p()] }] }))).toBe(false);
    expect(hasPageContent(doc({ type: 'taskList', content: [task('do it', false)] }))).toBe(true);
  });
});

describe('plainTextFromDoc', () => {
  it('joins blocks with newlines and prefixes task items', () => {
    const d = doc(
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      p('Hello world'),
      { type: 'taskList', content: [task('done', true), task('todo', false)] },
    );
    expect(plainTextFromDoc(d)).toBe('Title\nHello world\n[x] done\n[ ] todo');
  });

  it('is empty for the empty doc', () => {
    expect(plainTextFromDoc(EMPTY_DOC)).toBe('');
  });
});

describe('workPageOwnerKey', () => {
  it('group to-dos share one page per group', () => {
    expect(workPageOwnerKey('group', 'g1', 'u1')).toEqual({ groupId: 'g1', userId: null });
  });

  it('individual to-dos have one page per student', () => {
    expect(workPageOwnerKey('individual', 'g1', 'u1')).toEqual({ groupId: 'g1', userId: 'u1' });
  });
});

describe('canEditWorkPage', () => {
  it.each<[SubmissionStatus, boolean, boolean]>([
    ['none', true, true],
    ['rejected', true, true],
    ['pending', true, false],
    ['approved', true, false],
    ['none', false, false],
    ['rejected', false, false],
  ])('latest=%s viewable=%s → %s', (status, viewable, expected) => {
    expect(canEditWorkPage(status, viewable)).toBe(expected);
  });
});

describe('canSubmitWorkPage', () => {
  type Case = [FileRequirement, number, boolean, SubmissionStatus, true | string];
  const cases: Case[] = [];
  for (const req of FILE_REQUIREMENTS) {
    for (const fileCount of [0, 1]) {
      for (const hasContent of [false, true]) {
        for (const status of ['none', 'rejected', 'pending', 'approved'] as SubmissionStatus[]) {
          let expected: true | string;
          if (status === 'pending' || status === 'approved') expected = 'already_submitted';
          else if (req === 'required') expected = fileCount >= 1 ? true : 'file_required';
          else if (req === 'optional') expected = hasContent || fileCount >= 1 ? true : 'empty';
          else expected = hasContent ? true : 'empty';
          cases.push([req, fileCount, hasContent, status, expected]);
        }
      }
    }
  }

  it.each(cases)('req=%s files=%i content=%s latest=%s → %s', (req, fileCount, hasContent, status, expected) => {
    const result = canSubmitWorkPage({
      fileRequirement: req,
      fileCount,
      hasContent,
      latestStatus: status,
      phaseViewable: true,
    });
    if (expected === true) expect(result).toEqual({ ok: true });
    else {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe(expected);
        expect(result.message.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses the Thai hint for required files', () => {
    const r = canSubmitWorkPage({ fileRequirement: 'required', fileCount: 0, hasContent: true, latestStatus: 'none', phaseViewable: true });
    expect(r).toEqual({ ok: false, reason: 'file_required', message: 'งานนี้ต้องแนบไฟล์อย่างน้อย 1 ไฟล์' });
  });

  it('a locked phase blocks submission first', () => {
    const r = canSubmitWorkPage({ fileRequirement: 'optional', fileCount: 1, hasContent: true, latestStatus: 'none', phaseViewable: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('locked');
  });
});

describe('isSaveConflict', () => {
  const t1 = new Date('2026-10-04T10:00:00.123Z');
  const t2 = new Date('2026-10-04T10:00:05.456Z');

  it('no base and no server page → no conflict', () => {
    expect(isSaveConflict(null, null)).toBe(false);
  });

  it('no base and an empty server page → no conflict', () => {
    expect(isSaveConflict(null, { updatedAt: t1, content: EMPTY_DOC })).toBe(false);
  });

  it('no base but the server page has content → conflict', () => {
    expect(isSaveConflict(null, { updatedAt: t1, content: doc(p('hi')) })).toBe(true);
  });

  it('same version (ms precision) → no conflict', () => {
    expect(isSaveConflict(t1.toISOString(), { updatedAt: new Date(t1.getTime()), content: doc(p('hi')) })).toBe(false);
  });

  it('server newer than base → conflict', () => {
    expect(isSaveConflict(t1.toISOString(), { updatedAt: t2, content: doc(p('hi')) })).toBe(true);
  });
});

describe('validateWorkPageContent', () => {
  const realistic: WorkPageDoc = doc(
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'แผนงาน' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'bold italic', marks: [{ type: 'bold' }, { type: 'italic' }] },
        { type: 'text', text: ' link', marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '_blank', rel: 'noopener noreferrer nofollow', class: null } }] },
        { type: 'hardBreak' },
      ],
    },
    { type: 'bulletList', content: [{ type: 'listItem', content: [p('one')] }] },
    { type: 'taskList', content: [task('a', true), task('b', false)] },
  );

  it('accepts a realistic doc', () => {
    const r = validateWorkPageContent(realistic);
    expect(r.ok).toBe(true);
    if (r.ok) expect(checklistProgress(r.doc)).toEqual({ done: 1, total: 2 });
  });

  it('accepts the empty doc', () => {
    expect(validateWorkPageContent(EMPTY_DOC).ok).toBe(true);
  });

  it('rejects non-objects and non-doc roots', () => {
    expect(validateWorkPageContent('hello').ok).toBe(false);
    expect(validateWorkPageContent(null).ok).toBe(false);
    expect(validateWorkPageContent([]).ok).toBe(false);
    expect(validateWorkPageContent(p('x')).ok).toBe(false);
  });

  it('rejects unknown node types', () => {
    expect(validateWorkPageContent(doc({ type: 'iframe', attrs: { src: 'https://x' } })).ok).toBe(false);
  });

  it('rejects unknown mark types', () => {
    expect(validateWorkPageContent(doc({ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'script' }] }] })).ok).toBe(false);
  });

  it('rejects javascript: links', () => {
    const bad = doc({
      type: 'paragraph',
      content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }],
    });
    expect(validateWorkPageContent(bad).ok).toBe(false);
  });

  it('rejects content over the byte cap', () => {
    const big = doc(p('ก'.repeat(Math.ceil(MAX_CONTENT_BYTES / 3) + 10)));
    expect(validateWorkPageContent(big).ok).toBe(false);
  });

  it('rejects nesting deeper than 32', () => {
    let node: WorkPageNode = p('deep');
    for (let i = 0; i < 40; i++) node = { type: 'blockquote', content: [node] };
    expect(validateWorkPageContent(doc(node)).ok).toBe(false);
  });
});

describe('schema sync with the Tiptap extensions', () => {
  it('every node / mark the editor can produce is on the server allow-list', () => {
    const schema = getSchema(workPageExtensions());
    const nodes = Object.keys(schema.nodes);
    const marks = Object.keys(schema.marks);
    expect(nodes.length).toBeGreaterThan(5);
    for (const n of nodes) expect(WORK_PAGE_NODE_TYPES as readonly string[]).toContain(n);
    for (const m of marks) expect(WORK_PAGE_MARK_TYPES as readonly string[]).toContain(m);
    expect(nodes).toContain('taskItem');
    expect(marks).toContain('link');
  });
});
