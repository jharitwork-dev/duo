// Deadline-first task ordering (quick 261004-j6h, D-3').
import { describe, it, expect } from 'vitest';
import { compareTodosByDeadline, sortTodosByDeadline } from '@/lib/todo-order';

const t = (id: string, deadline: Date | string | null, orderIndex: number, createdAt = '2026-10-01T00:00:00Z') => ({
  id,
  deadline,
  orderIndex,
  createdAt,
});

describe('sortTodosByDeadline', () => {
  it('puts dated tasks first, ascending, undated after by orderIndex', () => {
    const list = [
      t('u2', null, 1),
      t('late', new Date('2026-10-20T00:00:00Z'), 0),
      t('u1', null, 0),
      t('early', '2026-10-05T00:00:00Z', 5),
    ];
    expect(sortTodosByDeadline(list).map((x) => x.id)).toEqual(['early', 'late', 'u1', 'u2']);
  });

  it('breaks deadline ties by orderIndex, then createdAt, then id', () => {
    const d = '2026-10-10T00:00:00Z';
    const list = [
      t('c', d, 1, '2026-10-01T00:00:00Z'),
      t('b', new Date(d), 0, '2026-10-02T00:00:00Z'),
      t('a', d, 0, '2026-10-02T00:00:00Z'),
      t('z', d, 0, '2026-10-01T00:00:00Z'),
    ];
    expect(sortTodosByDeadline(list).map((x) => x.id)).toEqual(['z', 'a', 'b', 'c']);
  });

  it('does not mutate the input', () => {
    const list = [t('u', null, 0), t('d', '2026-10-05T00:00:00Z', 1)];
    const copy = [...list];
    const sorted = sortTodosByDeadline(list);
    expect(list).toEqual(copy);
    expect(sorted).not.toBe(list);
  });

  it('compare returns 0 for the same item', () => {
    const x = t('x', null, 0);
    expect(compareTodosByDeadline(x, x)).toBe(0);
  });
});
