import { describe, expect, it } from 'vitest';
import { buildNodeDeadlines } from '../node-deadline';

const D = new Date('2026-10-18T16:59:00Z'); // 18 ต.ค. 23.59 Bangkok
const H = 3600_000;

describe('buildNodeDeadlines', () => {
  const none = { status: 'none' as const, firstSubmittedAt: null };

  it('skips to-dos without an effective deadline', () => {
    expect(buildNodeDeadlines([{ id: 'a', deadline: null }], null, {}, D)).toEqual({});
  });

  it('upcoming → muted "ส่งภายใน 18 ต.ค." (phase deadline inherited)', () => {
    const r = buildNodeDeadlines([{ id: 'a', deadline: null }], { deadline: D }, { a: none }, new Date(D.getTime() - 72 * H));
    expect(r.a).toEqual({ label: 'ส่งภายใน 18 ต.ค.', tone: 'muted', overdue: false });
  });

  it('due_soon → yellow relative', () => {
    const r = buildNodeDeadlines([{ id: 'a', deadline: D }], null, { a: none }, new Date(D.getTime() - 5 * H));
    expect(r.a).toEqual({ label: 'เหลือ 5 ชม.', tone: 'yellow', overdue: false });
  });

  it('overdue → red, flagged', () => {
    const r = buildNodeDeadlines([{ id: 'a', deadline: D.toISOString() }], null, {}, new Date(D.getTime() + 25 * H));
    expect(r.a).toEqual({ label: 'เลยกำหนด 1 วัน', tone: 'red', overdue: true });
  });

  it('on_time / late come from the first submission', () => {
    const now = new Date(D.getTime() + 72 * H);
    const r = buildNodeDeadlines(
      [
        { id: 'a', deadline: D },
        { id: 'b', deadline: D },
      ],
      null,
      {
        a: { status: 'rejected', firstSubmittedAt: new Date(D.getTime() - H) },
        b: { status: 'pending', firstSubmittedAt: new Date(D.getTime() + 2 * H) },
      },
      now,
    );
    expect(r.a).toEqual({ label: 'ส่งตรงเวลา', tone: 'green', overdue: false });
    expect(r.b).toEqual({ label: 'ช้า 2 ชม.', tone: 'orange', overdue: false });
  });
});
