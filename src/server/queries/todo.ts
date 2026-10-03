import { db } from '@/db';
import { todos } from '@/db/schema/todos';
import { classroomMembers } from '@/db/schema/classrooms';
import { eq, and, asc } from 'drizzle-orm';

/**
 * Returns one group's active (non-archived) todos for a classroom phase,
 * ordered by orderIndex.
 */
export async function getActiveTodos(phaseId: string, groupId: string) {
  const result = await db.query.todos.findMany({
    where: and(eq(todos.phaseId, phaseId), eq(todos.groupId, groupId), eq(todos.isArchived, false)),
    orderBy: [asc(todos.orderIndex)],
  });

  return result;
}

/**
 * Returns a single todo by ID with its attachments.
 */
export async function getTodoById(todoId: string) {
  const result = await db.query.todos.findFirst({
    where: eq(todos.id, todoId),
    with: {
      attachments: true,
    },
  });

  return result ?? null;
}

/**
 * Returns todo detail with attachments.
 * Verifies the user has access through the membership chain:
 * todo -> group -> classroom -> classroomMember
 */
export async function getTodoDetail(todoId: string, userId: string) {
  // Fetch the todo with attachments
  const todo = await db.query.todos.findFirst({
    where: eq(todos.id, todoId),
    with: {
      attachments: true,
      phase: true,
      group: {
        with: {
          classroom: true,
        },
      },
    },
  });

  if (!todo) return null;

  // Verify user has access via classroom membership
  const classroomId = todo.group.classroomId;
  const membership = await db.query.classroomMembers.findFirst({
    where: and(
      eq(classroomMembers.classroomId, classroomId),
      eq(classroomMembers.userId, userId),
    ),
  });

  if (!membership) {
    throw new Error('Access denied: user is not a member of this classroom');
  }

  return todo;
}
