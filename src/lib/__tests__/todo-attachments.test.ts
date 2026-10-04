// Pure rules for teacher attachments (quick 261004-gid). No network, no R2, no DB.
import { describe, it, expect } from 'vitest';
import {
  ATTACHMENT_ERRORS,
  MAX_ATTACHMENTS_PER_TODO,
  buildAttachmentKey,
  checkAttachmentCapacity,
  inferAttachmentContentType,
  isAttachmentKeyInScope,
  resolveAttachmentScope,
  sanitizeAttachmentName,
} from '@/lib/todo-attachments';
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_FILE_SIZE, validateAttachmentFile, validateSubmissionFile } from '@/lib/r2';
import { computeOrphanFileKeys } from '@/lib/work-page';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MB = 1024 * 1024;

describe('validateAttachmentFile', () => {
  it('accepts a 25 MB docx and rejects 25 MB + 1 byte', () => {
    expect(ATTACHMENT_MAX_FILE_SIZE).toBe(25 * MB);
    expect(validateAttachmentFile(DOCX, 25 * MB)).toBe(true);
    expect(validateAttachmentFile(DOCX, 25 * MB + 1)).toBe(false);
  });

  it('rejects an empty file', () => {
    expect(validateAttachmentFile('application/pdf', 0)).toBe(false);
  });

  it('accepts the extra office/image/text types', () => {
    for (const t of ['application/vnd.ms-excel', 'application/vnd.ms-powerpoint', 'image/gif', 'text/plain', 'text/csv', 'application/msword']) {
      expect(validateAttachmentFile(t, 1000), t).toBe(true);
    }
  });

  it('rejects executables and unknown types', () => {
    expect(validateAttachmentFile('application/x-msdownload', 1000)).toBe(false);
    expect(validateAttachmentFile('', 1000)).toBe(false);
  });

  it('leaves the student submission allow-list unchanged', () => {
    expect(validateSubmissionFile('image/gif', 1000)).toBe(false);
    expect(validateSubmissionFile('text/plain', 1000)).toBe(false);
  });

  it('ATTACHMENT_ACCEPT lists the common extensions', () => {
    for (const ext of ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.gif', '.txt', '.csv']) {
      expect(ATTACHMENT_ACCEPT.split(',')).toContain(ext);
    }
  });
});

describe('inferAttachmentContentType', () => {
  it('maps the extension when the browser gives no type (case-insensitive)', () => {
    expect(inferAttachmentContentType('Brief.DOCX', '')).toBe(DOCX);
    expect(inferAttachmentContentType('data.xls', '')).toBe('application/vnd.ms-excel');
  });

  it('keeps a non-empty browser type', () => {
    expect(inferAttachmentContentType('a.pdf', 'application/pdf')).toBe('application/pdf');
  });

  it('returns an empty string for unknown extensions', () => {
    expect(inferAttachmentContentType('x.exe', '')).toBe('');
    expect(inferAttachmentContentType('noext', '')).toBe('');
  });
});

describe('resolveAttachmentScope', () => {
  it('uses the to-do id for a single to-do', () => {
    expect(resolveAttachmentScope([{ id: 't1', assignmentId: null }])).toEqual({ ok: true, scope: 't1' });
    expect(resolveAttachmentScope([{ id: 't1', assignmentId: 'a1' }])).toEqual({ ok: true, scope: 't1' });
  });

  it('uses the shared assignmentId for several copies', () => {
    expect(
      resolveAttachmentScope([
        { id: 't1', assignmentId: 'a1' },
        { id: 't2', assignmentId: 'a1' },
      ]),
    ).toEqual({ ok: true, scope: 'a1' });
  });

  it('rejects to-dos with different or null assignmentIds and an empty list', () => {
    expect(
      resolveAttachmentScope([
        { id: 't1', assignmentId: 'a1' },
        { id: 't2', assignmentId: 'a2' },
      ]).ok,
    ).toBe(false);
    expect(
      resolveAttachmentScope([
        { id: 't1', assignmentId: null },
        { id: 't2', assignmentId: null },
      ]).ok,
    ).toBe(false);
    expect(resolveAttachmentScope([]).ok).toBe(false);
  });
});

describe('buildAttachmentKey / isAttachmentKeyInScope', () => {
  it('builds a flat, sanitized key under the scope', () => {
    const key = buildAttachmentKey('a1', 'id1', 'แผนงาน (v2).pdf');
    expect(key.startsWith('attachments/a1/id1-')).toBe(true);
    const rest = key.slice('attachments/a1/'.length);
    expect(rest.includes('/')).toBe(false);
    const namePart = key.slice('attachments/a1/id1-'.length);
    expect(namePart.length).toBeLessThanOrEqual(100);
    expect(namePart.endsWith('.pdf')).toBe(true);
  });

  it('caps long names at 100 characters', () => {
    expect(sanitizeAttachmentName('x'.repeat(300) + '.pdf').length).toBe(100);
    expect(sanitizeAttachmentName('../../etc/passwd').includes('/')).toBe(false);
  });

  it('accepts keys of the same scope only', () => {
    const key = buildAttachmentKey('a1', 'id1', 'brief.pdf');
    expect(isAttachmentKeyInScope(key, 'a1')).toBe(true);
    expect(isAttachmentKeyInScope(key, 'a2')).toBe(false);
    expect(isAttachmentKeyInScope('attachments/a1/..', 'a1')).toBe(false);
    expect(isAttachmentKeyInScope('attachments/a1/x/../y', 'a1')).toBe(false);
    expect(isAttachmentKeyInScope('attachments/a1', 'a1')).toBe(false);
    expect(isAttachmentKeyInScope('attachments/a1/', 'a1')).toBe(false);
    expect(isAttachmentKeyInScope('submissions/a1/x.pdf', 'a1')).toBe(false);
  });
});

describe('checkAttachmentCapacity', () => {
  it('allows up to the limit', () => {
    expect(MAX_ATTACHMENTS_PER_TODO).toBe(10);
    expect(checkAttachmentCapacity({ t1: 9, t2: 3 }, 1)).toEqual({ ok: true });
  });

  it('names the full to-do', () => {
    expect(checkAttachmentCapacity({ t1: 10 }, 1)).toEqual({ ok: false, todoId: 't1' });
    expect(checkAttachmentCapacity({ t1: 2, t2: 9 }, 2)).toEqual({ ok: false, todoId: 't2' });
  });

  it('has Thai error strings', () => {
    expect(ATTACHMENT_ERRORS.noStorage).toBe('ยังไม่ได้ตั้งค่าที่เก็บไฟล์');
    expect(ATTACHMENT_ERRORS.tooMany).toBe('แนบได้สูงสุด 10 ไฟล์ต่องาน');
  });
});

describe('shared attachment keys (computeOrphanFileKeys)', () => {
  it('keeps a key still referenced by another copy and returns an unreferenced one', () => {
    const shared = 'attachments/a1/u1-brief.pdf';
    const own = 'attachments/t9/u2-form.pdf';
    expect(computeOrphanFileKeys([shared, own], [shared])).toEqual([own]);
    expect(computeOrphanFileKeys([shared], [])).toEqual([shared]);
  });
});
