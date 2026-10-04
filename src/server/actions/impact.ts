'use server';

// Read-only "what will be deleted" counts for the shared confirm dialog.

import { z } from 'zod';
import { db } from '@/db';
import { classroomMembers } from '@/db/schema/classrooms';
import { groups, groupMembers } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { submissions } from '@/db/schema/submissions';
import { and, count, countDistinct, eq, type SQL } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import {
  assertClassroomEditor,
  assertPhaseEditor,
  assertTodoEditor,
  authorizeGroupDelete,
} from '@/server/phase-helpers';

export type DeletionImpact = {
  name: string;
  /** Group members who become "ยังไม่มีกลุ่ม" (group) or students in the classroom (classroom). */
  members?: number;
  todos: number;
  submissions: number;
  groups?: number;
  phases?: number;
  /** Number of to-do copies in scope (todoAllCopies). */
  copies?: number;
  /** True when the server will require typing `name` to confirm. */
  requiresConfirmation: boolean;
  /** Set when the caller may not delete (e.g. a student's group already has submissions). */
  blockedReason?: string;
};

const impactSchema = z.object({
  kind: z.enum(['group', 'phase', 'todo', 'todoAllCopies', 'classroom']),
  id: z.string().min(1),
});

async function countTodos(where: SQL | undefined): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(todos)
    .innerJoin(phases, eq(phases.id, todos.phaseId))
    .where(where);
  return row?.n ?? 0;
}

async function countSubmissions(where: SQL | undefined): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(submissions)
    .innerJoin(todos, eq(todos.id, submissions.todoId))
    .innerJoin(phases, eq(phases.id, todos.phaseId))
    .where(where);
  return row?.n ?? 0;
}

export async function getDeletionImpact(input: z.infer<typeof impactSchema>): Promise<DeletionImpact> {
  const userId = await getCurrentUserId();
  const data = impactSchema.parse(input);

  switch (data.kind) {
    case 'group': {
      // Classroom editors, or the self_create creator (see canDeleteGroup).
      const { group, submissionCount, decision } = await authorizeGroupDelete(data.id, userId);
      const [members] = await db.select({ n: count() }).from(groupMembers).where(eq(groupMembers.groupId, group.id));
      return {
        name: group.name,
        members: members?.n ?? 0,
        todos: await countTodos(eq(todos.groupId, group.id)),
        submissions: submissionCount,
        requiresConfirmation: decision.ok && decision.requiresConfirmation,
        blockedReason: decision.ok ? undefined : decision.error,
      };
    }
    case 'phase': {
      const { phase } = await assertPhaseEditor(data.id, userId);
      const [groupRow] = await db
        .select({ n: countDistinct(todos.groupId) })
        .from(todos)
        .where(eq(todos.phaseId, phase.id));
      const submissionTotal = await countSubmissions(eq(todos.phaseId, phase.id));
      return {
        name: phase.name,
        todos: await countTodos(eq(todos.phaseId, phase.id)),
        groups: groupRow?.n ?? 0,
        submissions: submissionTotal,
        requiresConfirmation: submissionTotal > 0,
        blockedReason: phase.isArchived ? undefined : 'เก็บ Phase ก่อนลบถาวร',
      };
    }
    case 'todo':
    case 'todoAllCopies': {
      const { todo, classroom } = await assertTodoEditor(data.id, userId);
      const scope =
        data.kind === 'todoAllCopies' && todo.assignmentId
          ? and(eq(todos.assignmentId, todo.assignmentId), eq(phases.classroomId, classroom.id))
          : eq(todos.id, todo.id);
      const copies = await countTodos(scope);
      const submissionTotal = await countSubmissions(scope);
      return {
        name: todo.title,
        todos: copies,
        copies,
        submissions: submissionTotal,
        requiresConfirmation: submissionTotal > 0,
      };
    }
    case 'classroom': {
      const classroom = await assertClassroomEditor(data.id, userId);
      const [groupRow] = await db.select({ n: count() }).from(groups).where(eq(groups.classroomId, classroom.id));
      const [phaseRow] = await db.select({ n: count() }).from(phases).where(eq(phases.classroomId, classroom.id));
      const [studentRow] = await db
        .select({ n: count() })
        .from(classroomMembers)
        .where(and(eq(classroomMembers.classroomId, classroom.id), eq(classroomMembers.role, 'student')));
      return {
        name: classroom.name,
        members: studentRow?.n ?? 0,
        groups: groupRow?.n ?? 0,
        phases: phaseRow?.n ?? 0,
        todos: await countTodos(eq(phases.classroomId, classroom.id)),
        submissions: await countSubmissions(eq(phases.classroomId, classroom.id)),
        requiresConfirmation: true,
      };
    }
  }
}
