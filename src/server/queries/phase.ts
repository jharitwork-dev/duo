import { db } from '@/db';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { eq, and, asc } from 'drizzle-orm';

/**
 * Returns all active (non-archived) phases for a group,
 * ordered by orderIndex, with nested active todos.
 */
export async function getActivePhases(groupId: string) {
  const result = await db.query.phases.findMany({
    where: and(eq(phases.groupId, groupId), eq(phases.isArchived, false)),
    orderBy: [asc(phases.orderIndex)],
    with: {
      todos: {
        where: eq(todos.isArchived, false),
        orderBy: [asc(todos.orderIndex)],
      },
    },
  });

  return result;
}

/**
 * Returns a single phase by ID with its active (non-archived) todos.
 */
export async function getPhaseById(phaseId: string) {
  const result = await db.query.phases.findFirst({
    where: eq(phases.id, phaseId),
    with: {
      todos: {
        where: eq(todos.isArchived, false),
        orderBy: [asc(todos.orderIndex)],
      },
    },
  });

  return result ?? null;
}

/**
 * Returns archived phases for a group (for restore UI).
 */
export async function getArchivedPhases(groupId: string) {
  const result = await db.query.phases.findMany({
    where: and(eq(phases.groupId, groupId), eq(phases.isArchived, true)),
    orderBy: [asc(phases.orderIndex)],
  });

  return result;
}
