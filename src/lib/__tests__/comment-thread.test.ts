import { describe, it, expect } from 'vitest';
import {
  COMMENT_EDIT_WINDOW_MS,
  COMMENT_MAX,
  canDeleteComment,
  canEditComment,
  formatCommentTime,
  hasUnreadTeacherComments,
  linkifySegments,
  normalizeCommentBody,
  publicDisplayName,
  resolveThreadOwner,
  roundForSubmission,
  toCommentView,
  type LinkSegment,
} from '@/lib/comment-thread';
import { formatSubmissionDate } from '@/lib/format';

function joined(segments: LinkSegment[]): string {
  return segments.map((s) => (s.type === 'text' ? s.text : s.label)).join('');
}

describe('normalizeCommentBody', () => {
  it('converts CRLF, strips control characters (keeps \\n and \\t) and trims', () => {
    const r = normalizeCommentBody('  สวัสดี\r\nครับ\u0007\tโอเค\u0000  ');
    expect(r).toEqual({ ok: true, body: 'สวัสดี\nครับ\tโอเค' });
  });

  it('rejects empty and whitespace-only bodies', () => {
    expect(normalizeCommentBody('').ok).toBe(false);
    expect(normalizeCommentBody('   \n\t ').ok).toBe(false);
  });

  it('enforces the 2000 character maximum', () => {
    expect(COMMENT_MAX).toBe(2000);
    expect(normalizeCommentBody('ก'.repeat(2000))).toEqual({ ok: true, body: 'ก'.repeat(2000) });
    expect(normalizeCommentBody('a'.repeat(2001)).ok).toBe(false);
  });

  it('keeps Thai text and inner newlines', () => {
    expect(normalizeCommentBody('บรรทัดแรก\n\nบรรทัดสอง')).toEqual({ ok: true, body: 'บรรทัดแรก\n\nบรรทัดสอง' });
  });
});

describe('linkifySegments', () => {
  it('links http(s) URLs and leaves trailing punctuation outside', () => {
    const input = 'ดู https://a.com/x?y=1. ต่อ';
    const segs = linkifySegments(input);
    expect(segs).toEqual([
      { type: 'text', text: 'ดู ' },
      { type: 'link', href: 'https://a.com/x?y=1', label: 'https://a.com/x?y=1' },
      { type: 'text', text: '. ต่อ' },
    ]);
    expect(joined(segs)).toBe(input);
  });

  it.each(['(https://a.com)', 'https://a.com!', "'https://a.com'", 'https://a.com?', 'https://a.com],'])(
    'strips trailing punctuation in %s',
    (input) => {
      const segs = linkifySegments(input);
      const link = segs.find((s) => s.type === 'link');
      expect(link).toMatchObject({ href: 'https://a.com' });
      expect(joined(segs)).toBe(input);
    },
  );

  it('prefixes www. links with https://', () => {
    const segs = linkifySegments('www.b.org');
    expect(segs).toEqual([{ type: 'link', href: 'https://www.b.org', label: 'www.b.org' }]);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', '<script>x</script>', 'ftp://x.com/file'])(
    'keeps %s as a single literal text segment',
    (input) => {
      expect(linkifySegments(input)).toEqual([{ type: 'text', text: input }]);
    },
  );

  it('handles multiple links and newlines', () => {
    const input = 'a http://x.io\nb www.y.co.th/p';
    const segs = linkifySegments(input);
    expect(segs.filter((s) => s.type === 'link').map((s) => (s as { href: string }).href)).toEqual([
      'http://x.io',
      'https://www.y.co.th/p',
    ]);
    expect(joined(segs)).toBe(input);
  });

  it('returns [] for an empty string', () => {
    expect(linkifySegments('')).toEqual([]);
  });
});

describe('canEditComment / canDeleteComment', () => {
  const created = new Date('2026-10-04T10:00:00Z');
  const base = { userId: 'u1', createdAt: created, deletedAt: null as Date | null };

  it('lets the author edit within 15 minutes', () => {
    expect(COMMENT_EDIT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(canEditComment(base, 'u1', new Date(created.getTime() + COMMENT_EDIT_WINDOW_MS))).toBe(true);
  });

  it('blocks after 15 min + 1 s, for non-authors and for deleted comments', () => {
    expect(canEditComment(base, 'u1', new Date(created.getTime() + COMMENT_EDIT_WINDOW_MS + 1000))).toBe(false);
    expect(canEditComment(base, 'u2', created)).toBe(false);
    expect(canEditComment({ ...base, deletedAt: created }, 'u1', created)).toBe(false);
  });

  it('lets the author or a classroom editor delete a non-deleted comment', () => {
    expect(canDeleteComment(base, 'u1', false)).toBe(true);
    expect(canDeleteComment(base, 't1', true)).toBe(true);
    expect(canDeleteComment(base, 'u2', false)).toBe(false);
    expect(canDeleteComment({ ...base, deletedAt: created }, 'u1', true)).toBe(false);
  });
});

describe('roundForSubmission', () => {
  it('returns the 1-based round or null', () => {
    expect(roundForSubmission('s2', ['s1', 's2', 's3'])).toBe(2);
    expect(roundForSubmission(null, ['s1'])).toBeNull();
    expect(roundForSubmission('zz', ['s1'])).toBeNull();
  });
});

describe('resolveThreadOwner', () => {
  const group = { mode: 'group' as const, todoGroupId: 'g1', viewerId: 'stu1' };
  const indiv = { mode: 'individual' as const, todoGroupId: 'g1', viewerId: 'stu1' };

  it('student on a group to-do gets the group thread', () => {
    expect(resolveThreadOwner({ ...group, viewerKind: 'student' })).toEqual({
      ok: true,
      owner: { groupId: 'g1', userId: null },
    });
  });

  it('student on an individual to-do gets their own thread', () => {
    expect(resolveThreadOwner({ ...indiv, viewerKind: 'student' })).toEqual({
      ok: true,
      owner: { groupId: 'g1', userId: 'stu1' },
    });
  });

  it('student asking for another thread is forbidden', () => {
    expect(resolveThreadOwner({ ...group, viewerKind: 'student', groupId: 'g2' })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(resolveThreadOwner({ ...indiv, viewerKind: 'student', studentId: 'stu2' })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    // Passing their own ids is fine.
    expect(resolveThreadOwner({ ...indiv, viewerKind: 'student', groupId: 'g1', studentId: 'stu1' }).ok).toBe(true);
  });

  it('editor on a group to-do: omitted or matching groupId ok, mismatch forbidden', () => {
    const editor = { ...group, viewerId: 't1', viewerKind: 'editor' as const };
    expect(resolveThreadOwner(editor)).toEqual({ ok: true, owner: { groupId: 'g1', userId: null } });
    expect(resolveThreadOwner({ ...editor, groupId: 'g1' })).toEqual({ ok: true, owner: { groupId: 'g1', userId: null } });
    expect(resolveThreadOwner({ ...editor, groupId: 'g2' })).toEqual({ ok: false, error: 'forbidden' });
  });

  it('editor on an individual to-do needs a known studentId', () => {
    const editor = { ...indiv, viewerId: 't1', viewerKind: 'editor' as const };
    expect(resolveThreadOwner(editor)).toEqual({ ok: false, error: 'student_required' });
    expect(resolveThreadOwner({ ...editor, studentId: 'stu9', isKnownStudent: false })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(resolveThreadOwner({ ...editor, studentId: 'stu2', isKnownStudent: true })).toEqual({
      ok: true,
      owner: { groupId: 'g1', userId: 'stu2' },
    });
  });
});

describe('formatCommentTime', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  it('is relative under 24 hours', () => {
    expect(formatCommentTime(new Date(now.getTime() - 30_000), now)).toBe('เมื่อสักครู่');
    expect(formatCommentTime(new Date(now.getTime() - 5 * 60_000), now)).toBe('5 นาทีที่แล้ว');
    expect(formatCommentTime(new Date(now.getTime() - 3 * 3_600_000), now)).toBe('3 ชม.ที่แล้ว');
  });

  it('falls back to the absolute date at 24 hours and later', () => {
    const old = new Date('2026-10-02T06:59:00Z');
    expect(formatCommentTime(old, now)).toBe(formatSubmissionDate(old));
    expect(formatCommentTime(old.toISOString(), now.toISOString())).toBe(formatSubmissionDate(old));
  });

  it('treats a slightly-future time (clock skew) as just now', () => {
    expect(formatCommentTime(new Date(now.getTime() + 5000), now)).toBe('เมื่อสักครู่');
  });
});

describe('hasUnreadTeacherComments', () => {
  const t = (iso: string) => new Date(iso);
  const teacher = { authorRole: 'teacher' as const, createdAt: t('2026-10-04T10:00:00Z'), deletedAt: null };

  it('is true for a teacher comment newer than last seen (or never seen)', () => {
    expect(hasUnreadTeacherComments([teacher], null)).toBe(true);
    expect(hasUnreadTeacherComments([teacher], t('2026-10-04T09:00:00Z'))).toBe(true);
  });

  it('is false when seen, deleted, or only from students', () => {
    expect(hasUnreadTeacherComments([teacher], t('2026-10-04T10:00:00Z'))).toBe(false);
    expect(hasUnreadTeacherComments([{ ...teacher, deletedAt: t('2026-10-04T10:01:00Z') }], null)).toBe(false);
    expect(hasUnreadTeacherComments([{ ...teacher, authorRole: 'student' }], null)).toBe(false);
    expect(hasUnreadTeacherComments([], null)).toBe(false);
  });
});

describe('publicDisplayName', () => {
  it('uses full name, then username, never an email', () => {
    expect(publicDisplayName({ firstName: 'สมชาย', lastName: 'ใจดี', username: 'sc' })).toBe('สมชาย ใจดี');
    expect(publicDisplayName({ firstName: null, lastName: null, username: 'sc' })).toBe('sc');
    expect(publicDisplayName({ firstName: ' ', lastName: null, username: null })).toBe('ไม่ระบุชื่อ');
    expect(publicDisplayName({})).toBe('ไม่ระบุชื่อ');
  });
});

describe('toCommentView', () => {
  const now = new Date('2026-10-04T10:05:00Z');
  const row = {
    id: 'c1',
    userId: 'u1',
    content: 'hello',
    authorRole: 'student' as const,
    submissionId: 's2',
    createdAt: new Date('2026-10-04T10:00:00Z'),
    editedAt: null,
    deletedAt: null,
  };
  const ctx = {
    viewerId: 'u1',
    viewerIsEditor: false,
    now,
    directory: new Map([['u1', { publicName: 'Mint', imageUrl: null }]]),
    submissionIdsOldestFirst: ['s1', 's2'],
  };

  it('maps a live comment', () => {
    expect(toCommentView(row, ctx)).toEqual({
      id: 'c1',
      authorName: 'Mint',
      authorImageUrl: null,
      authorRole: 'student',
      isMine: true,
      body: 'hello',
      createdAt: '2026-10-04T10:00:00.000Z',
      editedAt: null,
      deleted: false,
      round: 2,
      canEdit: true,
      canDelete: true,
    });
  });

  it('hides the body of a deleted comment and never exposes an email', () => {
    const view = toCommentView({ ...row, deletedAt: now }, { ...ctx, viewerId: 't1', viewerIsEditor: true });
    expect(view.body).toBeNull();
    expect(view.deleted).toBe(true);
    expect(view.canEdit).toBe(false);
    expect(view.canDelete).toBe(false);
    expect(view.isMine).toBe(false);
    expect(JSON.stringify(view)).not.toMatch(/email|@/);
  });

  it('falls back to a placeholder name for unknown authors', () => {
    expect(toCommentView({ ...row, userId: 'ghost' }, ctx).authorName).toBe('ไม่ระบุชื่อ');
  });
});
