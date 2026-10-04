import { describe, it, expect } from 'vitest';
import { summarizeTodoReview } from '@/lib/todo-review-status';

const row = (submittedBy: string, status: 'pending' | 'approved' | 'rejected', groupId: string | null = 'g1') => ({
  submittedBy,
  status,
  groupId,
});

describe('summarizeTodoReview', () => {
  it('is none without submissions', () => {
    expect(summarizeTodoReview([], 'group', 'g1')).toEqual({ status: 'none', pendingCount: 0 });
  });

  it("uses the group's latest submission for group to-dos", () => {
    expect(summarizeTodoReview([row('a', 'rejected'), row('b', 'pending')], 'group', 'g1')).toEqual({
      status: 'rejected',
      pendingCount: 0,
    });
    expect(summarizeTodoReview([row('a', 'approved', 'g2')], 'group', 'g1').status).toBe('none');
  });

  it('prioritises pending > rejected > approved across students for individual to-dos', () => {
    const rows = [row('a', 'approved'), row('b', 'pending'), row('c', 'rejected'), row('b', 'rejected')];
    expect(summarizeTodoReview(rows, 'individual', 'g1')).toEqual({ status: 'pending', pendingCount: 1 });
    expect(summarizeTodoReview([row('a', 'approved'), row('c', 'rejected')], 'individual', 'g1').status).toBe(
      'rejected',
    );
    expect(summarizeTodoReview([row('a', 'approved'), row('a', 'pending')], 'individual', 'g1')).toEqual({
      status: 'approved',
      pendingCount: 0,
    });
  });

  it('counts each waiting student once', () => {
    const rows = [row('a', 'pending'), row('b', 'pending'), row('a', 'rejected')];
    expect(summarizeTodoReview(rows, 'individual', 'g1').pendingCount).toBe(2);
  });
});
