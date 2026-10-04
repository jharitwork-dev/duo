// Deadline-first ordering for phase task lists (quick 261004-j6h, D-3').
// Dated tasks first (earliest deadline first); undated after, by order_index → created_at → id.

type OrderableTodo = { id: string; deadline: Date | string | null; orderIndex: number; createdAt: Date | string };

function time(v: Date | string): number {
  return v instanceof Date ? v.getTime() : new Date(v).getTime();
}

export function compareTodosByDeadline(a: OrderableTodo, b: OrderableTodo): number {
  const aDated = a.deadline != null;
  const bDated = b.deadline != null;
  if (aDated !== bDated) return aDated ? -1 : 1;
  if (aDated && bDated) {
    const diff = time(a.deadline!) - time(b.deadline!);
    if (diff !== 0) return diff;
  }
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
  const created = time(a.createdAt) - time(b.createdAt);
  if (created !== 0) return created;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Returns a new, deadline-ordered array (input is not mutated). */
export function sortTodosByDeadline<T extends OrderableTodo>(list: readonly T[]): T[] {
  return [...list].sort(compareTodosByDeadline);
}
