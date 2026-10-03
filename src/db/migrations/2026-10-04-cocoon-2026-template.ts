/**
 * One-off ops script (user decision 2026-10-04): replace the test "Market Research" phase in classroom
 * "Cocoon 2026" with the built-in "Cocoon Incubation" template, giving every group the template to-dos.
 *
 * Run: npx tsx src/db/migrations/2026-10-04-cocoon-2026-template.ts --dry-run | --apply
 * Refuses to run if any submission exists in the classroom (nothing student-made may be deleted).
 */
import { db } from '@/db';
import { classrooms } from '@/db/schema/classrooms';
import { groups } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { submissions } from '@/db/schema/submissions';
import { phaseTemplates } from '@/db/schema/phaseTemplates';
import { and, eq, inArray } from 'drizzle-orm';
import { createId } from '@/lib/ids';
import { parseTemplateStructure } from '@/lib/template-structure';
import { syncClassroomProgress } from '@/server/phase-helpers';

const CLASSROOM_NAME = 'Cocoon 2026';
const TEMPLATE_NAME = 'Cocoon Incubation';
const ACTOR = 'user_3JuDNaxgc1gocac9wHnDHmXcgTE'; // superadmin (jharit.work@gmail.com)

class DryRunRollback extends Error {}

async function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--dry-run') ? 'dry-run' : null;
  if (!mode) throw new Error('Pass --dry-run or --apply');

  const classroom = await db.query.classrooms.findFirst({ where: eq(classrooms.name, CLASSROOM_NAME) });
  if (!classroom) throw new Error(`Classroom "${CLASSROOM_NAME}" not found`);
  const template = await db.query.phaseTemplates.findFirst({ where: eq(phaseTemplates.name, TEMPLATE_NAME) });
  if (!template) throw new Error(`Template "${TEMPLATE_NAME}" not found`);

  const classGroups = await db.select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.classroomId, classroom.id));
  const oldPhases = await db.select({ id: phases.id, name: phases.name }).from(phases).where(eq(phases.classroomId, classroom.id));
  const oldTodos = oldPhases.length
    ? await db.select({ id: todos.id }).from(todos).where(inArray(todos.phaseId, oldPhases.map((p) => p.id)))
    : [];
  const subs = oldTodos.length
    ? await db.select({ id: submissions.id }).from(submissions).where(inArray(submissions.todoId, oldTodos.map((t) => t.id)))
    : [];

  console.log(`MODE: ${mode}`);
  console.log(`classroom=${classroom.name} groups=[${classGroups.map((g) => g.name).join(', ')}]`);
  console.log(`BEFORE phases=[${oldPhases.map((p) => p.name).join(', ')}] todos=${oldTodos.length} submissions=${subs.length}`);
  if (subs.length > 0) throw new Error('Refusing: submissions exist in this classroom');

  const structure = parseTemplateStructure(template.structure);
  const groupIds = classGroups.map((g) => g.id);

  try {
    await db.transaction(async (tx) => {
      if (oldPhases.length) {
        // cascades: todos (phase FK) and group_phase_progress rows
        await tx.delete(phases).where(and(eq(phases.classroomId, classroom.id), inArray(phases.id, oldPhases.map((p) => p.id))));
      }
      for (let i = 0; i < structure.phases.length; i++) {
        const tp = structure.phases[i];
        const [phase] = await tx
          .insert(phases)
          .values({ classroomId: classroom.id, name: tp.name, description: tp.description, orderIndex: i, createdBy: ACTOR })
          .returning({ id: phases.id });
        for (let j = 0; j < tp.todos.length; j++) {
          const tt = tp.todos[j];
          const assignmentId = groupIds.length > 1 ? createId() : null;
          if (groupIds.length) {
            await tx.insert(todos).values(
              groupIds.map((groupId) => ({
                phaseId: phase.id,
                groupId,
                assignmentId,
                title: tt.title,
                description: tt.description,
                notes: tt.notes,
                submissionMode: tt.submissionMode ?? 'group',
                orderIndex: j,
                createdBy: ACTOR,
              })),
            );
          }
        }
      }
      await syncClassroomProgress(tx, classroom.id);

      const newPhases = await tx.select({ id: phases.id, name: phases.name, orderIndex: phases.orderIndex }).from(phases).where(eq(phases.classroomId, classroom.id));
      const newTodos = await tx
        .select({ title: todos.title, groupId: todos.groupId, phaseId: todos.phaseId })
        .from(todos)
        .where(inArray(todos.phaseId, newPhases.map((p) => p.id)));
      console.log(`AFTER phases=${newPhases.sort((a, b) => a.orderIndex - b.orderIndex).map((p) => `#${p.orderIndex + 1} ${p.name}`).join(' | ')}`);
      for (const g of classGroups) {
        console.log(`  group ${g.name}: ${newTodos.filter((t) => t.groupId === g.id).length} todos`);
      }

      if (mode === 'dry-run') throw new DryRunRollback();
    });
    console.log('APPLIED — committed');
  } catch (err) {
    if (err instanceof DryRunRollback) {
      console.log('DRY RUN — rolled back');
      return;
    }
    throw err;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
