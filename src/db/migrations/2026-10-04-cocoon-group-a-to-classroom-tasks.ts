/**
 * Data op 2026-10-04: promote group "A"'s tasks in the active Cocoon 2026 phase
 * "Market Research : Prove ว่าตลาดมีจริงไหม & คนอยากซื้อจริงไหม" to classroom tasks (งานของห้องเรียน).
 *
 * For each of A's (non-archived, not-yet-linked) todos in that phase:
 *   - insert a classroom_tasks row with the same title/description/notes/mode/file requirement/deadline/order
 *   - link A's existing todo as that task's copy (classroom_task_id, assignment_id = task id, no overrides)
 * then run syncClassroomTasks so every other group gets its copy.
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-10-04-cocoon-group-a-to-classroom-tasks.ts --dry-run   # ROLLBACK
 *   npx tsx src/db/migrations/2026-10-04-cocoon-group-a-to-classroom-tasks.ts --apply     # COMMIT
 *
 * Idempotent: A's todos already linked are skipped; if none remain it prints "already migrated".
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const USAGE = 'Usage: npx tsx src/db/migrations/2026-10-04-cocoon-group-a-to-classroom-tasks.ts (--dry-run | --apply)';

const CLASSROOM_ID = 'w7s7qzlihgdpenlnz0j6lwut'; // Cocoon 2026
const GROUP_ID = 'o34oowddsg97abw97fcbwxrn'; // A
const PHASE_ID = 'bw4f1aas5xbxk2c9gz6dzyhz'; // Market Research : Prove ...

class Rollback extends Error {}

async function main() {
  const mode = process.argv[2];
  if (mode !== '--dry-run' && mode !== '--apply') {
    console.error(USAGE);
    process.exit(1);
  }
  const { db } = await import('@/db');
  const { todos } = await import('@/db/schema/todos');
  const { groups } = await import('@/db/schema/groups');
  const { classroomTasks } = await import('@/db/schema/classroomTasks');
  const { syncClassroomTasks } = await import('@/server/phase-helpers');
  const { and, eq, isNull, asc, count, isNotNull } = await import('drizzle-orm');

  try {
    await db.transaction(async (tx) => {
      const source = await tx
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.groupId, GROUP_ID),
            eq(todos.phaseId, PHASE_ID),
            eq(todos.isArchived, false),
            isNull(todos.classroomTaskId),
          ),
        )
        .orderBy(asc(todos.orderIndex));
      if (source.length === 0) {
        console.log('already migrated (no unlinked tasks left in group A for this phase)');
        throw new Rollback();
      }

      for (const t of source) {
        const [task] = await tx
          .insert(classroomTasks)
          .values({
            phaseId: PHASE_ID,
            title: t.title,
            description: t.description,
            notes: t.notes,
            submissionMode: t.submissionMode,
            fileRequirement: t.fileRequirement,
            deadline: t.deadline,
            orderIndex: t.orderIndex,
            createdBy: t.createdBy,
          })
          .returning({ id: classroomTasks.id });
        await tx
          .update(todos)
          .set({ classroomTaskId: task.id, assignmentId: task.id, overriddenFields: [] })
          .where(eq(todos.id, t.id));
        console.log(`  + classroom task ${task.id} "${t.title}" (A's todo ${t.id} linked)`);
      }

      const sync = await syncClassroomTasks(tx, CLASSROOM_ID);
      if (sync.r2Keys.length > 0) throw new Error(`sync wanted to delete R2 keys: ${sync.r2Keys.join(', ')}`);

      const [{ n: groupCount }] = await tx
        .select({ n: count() })
        .from(groups)
        .where(eq(groups.classroomId, CLASSROOM_ID));
      const [{ n: copyCount }] = await tx
        .select({ n: count() })
        .from(todos)
        .where(and(eq(todos.phaseId, PHASE_ID), isNotNull(todos.classroomTaskId)));
      const expected = groupCount * source.length;
      console.log(`groups=${groupCount} tasks=${source.length} copies=${copyCount} (expected ${expected})`);
      if (copyCount !== expected) throw new Error('copy count mismatch');

      if (mode === '--dry-run') {
        console.log('DRY RUN — rolled back');
        throw new Rollback();
      }
    });
    if (mode === '--apply') console.log('COMMITTED');
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
