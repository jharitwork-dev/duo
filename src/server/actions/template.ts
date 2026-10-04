'use server';

import { z } from 'zod';
import { db } from '@/db';
import { phaseTemplates } from '@/db/schema/phaseTemplates';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { groups } from '@/db/schema/groups';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { parseTemplateStructure, type TemplateStructure } from '@/lib/template-structure';
import { assertClassroomEditor, syncClassroomProgress } from '@/server/phase-helpers';
import { actionError, type ActionResult } from '@/lib/action-result';

const applyTemplateSchema = z.object({
  classroomId: z.string().min(1),
  templateId: z.string().min(1),
  /** Groups that receive the template's to-dos. May be empty (phases only). */
  groupIds: z.array(z.string().min(1)),
});

/**
 * Creates the classroom's phases from a template and, optionally, one independent copy of
 * every template to-do per selected group (shared assignmentId when > 1 group).
 * Refused when the classroom already has a non-archived phase (no silent duplication).
 */
export async function applyTemplate(input: z.infer<typeof applyTemplateSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = applyTemplateSchema.parse(input);
  const groupIds = [...new Set(data.groupIds)];
  await assertClassroomEditor(data.classroomId, userId);

  const existing = await db.query.phases.findFirst({
    where: and(eq(phases.classroomId, data.classroomId), eq(phases.isArchived, false)),
    columns: { id: true },
  });
  if (existing) {
    throw new Error('ห้องเรียนนี้มี Phase อยู่แล้ว — เก็บ Phase เดิมก่อนใช้เทมเพลต');
  }

  if (groupIds.length > 0) {
    const validGroups = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.classroomId, data.classroomId), inArray(groups.id, groupIds)));
    if (validGroups.length !== groupIds.length) {
      throw new Error('Some groups do not belong to this classroom');
    }
  }

  const template = await db.query.phaseTemplates.findFirst({
    where: eq(phaseTemplates.id, data.templateId),
  });
  if (!template) {
    throw new Error('Template not found');
  }

  const structure = parseTemplateStructure(template.structure);
  let phaseCount = 0;
  let todoCount = 0;

  await db.transaction(async (tx) => {
    for (let i = 0; i < structure.phases.length; i++) {
      const templatePhase = structure.phases[i];

      const [insertedPhase] = await tx
        .insert(phases)
        .values({
          classroomId: data.classroomId,
          name: templatePhase.name,
          description: templatePhase.description,
          orderIndex: i,
          createdBy: userId,
        })
        .returning({ id: phases.id });
      phaseCount++;

      if (groupIds.length === 0) continue;
      for (let j = 0; j < templatePhase.todos.length; j++) {
        const templateTodo = templatePhase.todos[j];
        const assignmentId = groupIds.length > 1 ? createId() : null;
        await tx.insert(todos).values(
          groupIds.map((groupId) => ({
            phaseId: insertedPhase.id,
            groupId,
            assignmentId,
            title: templateTodo.title,
            description: templateTodo.description,
            notes: templateTodo.notes,
            submissionMode: templateTodo.submissionMode ?? 'group',
            orderIndex: j,
            createdBy: userId,
          })),
        );
        todoCount += groupIds.length;
      }
    }

    await syncClassroomProgress(tx, data.classroomId);
  });

  return { success: true, phaseCount, todoCount };
}

const saveAsTemplateSchema = z.object({
  classroomId: z.string().min(1),
  /** Group whose to-dos are saved. Omit to save phases only. */
  groupId: z.string().min(1).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

/**
 * Saves the classroom's non-archived phases plus one chosen group's non-archived to-dos
 * (title, submissionMode, description, notes) as a custom template. Attachments are not copied.
 */
export async function saveAsTemplate(input: z.infer<typeof saveAsTemplateSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = saveAsTemplateSchema.parse(input);
  await assertClassroomEditor(data.classroomId, userId);

  const groupId = data.groupId;
  if (groupId) {
    const group = await db.query.groups.findFirst({
      where: and(eq(groups.id, groupId), eq(groups.classroomId, data.classroomId)),
      columns: { id: true },
    });
    if (!group) throw new Error('Group does not belong to this classroom');
  }

  const activePhases = await db.query.phases.findMany({
    where: and(eq(phases.classroomId, data.classroomId), eq(phases.isArchived, false)),
    orderBy: [asc(phases.orderIndex)],
    with: {
      todos: {
        // No group chosen -> match nothing (phases only).
        where: and(eq(todos.groupId, groupId ?? ''), eq(todos.isArchived, false)),
        orderBy: [asc(todos.orderIndex)],
      },
    },
  });

  const structure: TemplateStructure = {
    phases: activePhases.map((phase) => ({
      name: phase.name,
      description: phase.description ?? undefined,
      todos: groupId
        ? phase.todos.map((todo) => ({
            title: todo.title,
            submissionMode: todo.submissionMode,
            description: todo.description ?? undefined,
            notes: todo.notes ?? undefined,
          }))
        : [],
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

const updateTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
});

/** Renames / re-describes a custom template. Only its creator may change it; built-ins are read-only. */
export async function updateTemplate(input: z.infer<typeof updateTemplateSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) return actionError('ชื่อเทมเพลตต้องมี 1–200 ตัวอักษร');
  const data = parsed.data;

  const template = await db.query.phaseTemplates.findFirst({
    where: eq(phaseTemplates.id, data.templateId),
  });
  if (!template) throw new Error('Template not found');
  if (template.isBuiltIn) return actionError('แก้ไขเทมเพลตมาตรฐานไม่ได้');
  if (template.createdBy !== userId) throw new Error('You can only change templates you created');

  await db
    .update(phaseTemplates)
    .set({ name: data.name, description: data.description?.trim() || null })
    .where(eq(phaseTemplates.id, data.templateId));

  return { success: true };
}
