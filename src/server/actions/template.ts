'use server';

import { z } from 'zod';
import { db } from '@/db';
import { phaseTemplates } from '@/db/schema/phaseTemplates';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { eq, and, asc } from 'drizzle-orm';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

// Template structure type matching 02-RESEARCH.md Pattern 6
interface TemplatePhase {
  name: string;
  description?: string;
  todos: {
    title: string;
    submissionMode?: 'group' | 'individual';
  }[];
}

interface TemplateStructure {
  phases: TemplatePhase[];
}

const applyTemplateSchema = z.object({
  groupId: z.string().min(1),
  templateId: z.string().min(1),
});

export async function applyTemplate(input: z.infer<typeof applyTemplateSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = applyTemplateSchema.parse(input);

  // Fetch template
  const template = await db.query.phaseTemplates.findFirst({
    where: eq(phaseTemplates.id, data.templateId),
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const structure: TemplateStructure = JSON.parse(template.structure);

  // Create phases and todos in bulk
  let phaseCount = 0;

  await db.transaction(async (tx) => {
    for (let i = 0; i < structure.phases.length; i++) {
      const templatePhase = structure.phases[i];

      // First phase is active, rest are locked
      const status = i === 0 ? 'active' : 'locked';

      const [insertedPhase] = await tx
        .insert(phases)
        .values({
          groupId: data.groupId,
          name: templatePhase.name,
          description: templatePhase.description,
          orderIndex: i,
          status,
          createdBy: userId,
        })
        .returning({ id: phases.id });

      // Create todos for this phase
      for (let j = 0; j < templatePhase.todos.length; j++) {
        const templateTodo = templatePhase.todos[j];
        await tx.insert(todos).values({
          phaseId: insertedPhase.id,
          title: templateTodo.title,
          submissionMode: templateTodo.submissionMode ?? 'group',
          orderIndex: j,
          createdBy: userId,
        });
      }

      phaseCount++;
    }
  });

  return { success: true, phaseCount };
}

const saveAsTemplateSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function saveAsTemplate(input: z.infer<typeof saveAsTemplateSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = saveAsTemplateSchema.parse(input);

  // Read all active phases and todos for the group
  const activePhases = await db.query.phases.findMany({
    where: and(eq(phases.groupId, data.groupId), eq(phases.isArchived, false)),
    orderBy: [asc(phases.orderIndex)],
    with: {
      todos: {
        where: eq(todos.isArchived, false),
        orderBy: [asc(todos.orderIndex)],
      },
    },
  });

  // Serialize to template structure
  const structure: TemplateStructure = {
    phases: activePhases.map((phase) => ({
      name: phase.name,
      description: phase.description ?? undefined,
      todos: phase.todos.map((todo) => ({
        title: todo.title,
        submissionMode: todo.submissionMode,
      })),
    })),
  };

  const [inserted] = await db
    .insert(phaseTemplates)
    .values({
      name: data.name,
      description: data.description,
      isBuiltIn: false,
      createdBy: userId,
      structure: JSON.stringify(structure),
    })
    .returning({ id: phaseTemplates.id });

  return { success: true, templateId: inserted.id };
}

const deleteTemplateSchema = z.object({
  templateId: z.string().min(1),
});

export async function deleteTemplate(input: z.infer<typeof deleteTemplateSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = deleteTemplateSchema.parse(input);

  // Fetch template to verify ownership and not built-in
  const template = await db.query.phaseTemplates.findFirst({
    where: eq(phaseTemplates.id, data.templateId),
  });

  if (!template) {
    throw new Error('Template not found');
  }

  if (template.isBuiltIn) {
    throw new Error('Cannot delete built-in templates');
  }

  if (template.createdBy !== userId) {
    throw new Error('You can only delete templates you created');
  }

  await db.delete(phaseTemplates).where(eq(phaseTemplates.id, data.templateId));

  return { success: true };
}
