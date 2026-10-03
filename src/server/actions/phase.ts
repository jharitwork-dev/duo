'use server';

import { z } from 'zod';
import { db } from '@/db';
import { phases } from '@/db/schema/phases';
import { groups } from '@/db/schema/groups';
import { groupPhaseProgress, PHASE_STATUSES } from '@/db/schema/groupPhaseProgress';
import { eq, and, max, inArray } from 'drizzle-orm';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import {
  assertClassroomEditor,
  getPhaseClassroomId,
  syncClassroomProgress,
} from '@/server/phase-helpers';

const createPhaseSchema = z.object({
  classroomId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function createPhase(input: z.infer<typeof createPhaseSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = createPhaseSchema.parse(input);
  await assertClassroomEditor(data.classroomId, userId);

  const phaseId = await db.transaction(async (tx) => {
    const result = await tx
      .select({ maxOrder: max(phases.orderIndex) })
      .from(phases)
      .where(and(eq(phases.classroomId, data.classroomId), eq(phases.isArchived, false)));
    const nextOrder = (result[0]?.maxOrder ?? -1) + 1;

    const [inserted] = await tx
      .insert(phases)
      .values({
        classroomId: data.classroomId,
        name: data.name,
        description: data.description,
        orderIndex: nextOrder,
        createdBy: userId,
      })
      .returning({ id: phases.id });

    await syncClassroomProgress(tx, data.classroomId);
    return inserted.id;
  });

  return { success: true, phaseId };
}

const updatePhaseSchema = z.object({
  phaseId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  isFreeAccess: z.boolean().optional(),
  deadline: z.date().nullable().optional(),
});

export async function updatePhase(input: z.infer<typeof updatePhaseSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = updatePhaseSchema.parse(input);
  const { phaseId, ...updates } = data;
  await assertClassroomEditor(await getPhaseClassroomId(phaseId), userId);

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) updateFields.name = updates.name;
  if (updates.description !== undefined) updateFields.description = updates.description;
  if (updates.isFreeAccess !== undefined) updateFields.isFreeAccess = updates.isFreeAccess;
  if (updates.deadline !== undefined) updateFields.deadline = updates.deadline;

  await db.update(phases).set(updateFields).where(eq(phases.id, phaseId));

  return { success: true };
}

const reorderPhasesSchema = z.object({
  classroomId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
});

export async function reorderPhases(input: z.infer<typeof reorderPhasesSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = reorderPhasesSchema.parse(input);
  await assertClassroomEditor(data.classroomId, userId);

  if (new Set(data.orderedIds).size !== data.orderedIds.length) {
    throw new Error('Duplicate phase IDs');
  }

  // Verify all IDs belong to this classroom and are not archived
  const existingPhases = await db
    .select({ id: phases.id })
    .from(phases)
    .where(
      and(
        eq(phases.classroomId, data.classroomId),
        eq(phases.isArchived, false),
        inArray(phases.id, data.orderedIds),
      ),
    );

  if (existingPhases.length !== data.orderedIds.length) {
    throw new Error('Some phase IDs are invalid, archived, or do not belong to this classroom');
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < data.orderedIds.length; i++) {
      await tx
        .update(phases)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(eq(phases.id, data.orderedIds[i]));
    }
    await syncClassroomProgress(tx, data.classroomId);
  });

  return { success: true };
}

const archivePhaseSchema = z.object({
  phaseId: z.string().min(1),
});

export async function archivePhase(input: z.infer<typeof archivePhaseSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = archivePhaseSchema.parse(input);
  const classroomId = await getPhaseClassroomId(data.phaseId);
  await assertClassroomEditor(classroomId, userId);

  await db.transaction(async (tx) => {
    await tx
      .update(phases)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(phases.id, data.phaseId));
    await syncClassroomProgress(tx, classroomId);
  });

  return { success: true };
}

const restorePhaseSchema = z.object({
  phaseId: z.string().min(1),
});

export async function restorePhase(input: z.infer<typeof restorePhaseSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = restorePhaseSchema.parse(input);
  const classroomId = await getPhaseClassroomId(data.phaseId);
  await assertClassroomEditor(classroomId, userId);

  await db.transaction(async (tx) => {
    // Restored phases are appended at the end of the active list.
    const result = await tx
      .select({ maxOrder: max(phases.orderIndex) })
      .from(phases)
      .where(and(eq(phases.classroomId, classroomId), eq(phases.isArchived, false)));
    const nextOrder = (result[0]?.maxOrder ?? -1) + 1;

    await tx
      .update(phases)
      .set({ isArchived: false, orderIndex: nextOrder, updatedAt: new Date() })
      .where(eq(phases.id, data.phaseId));
    await syncClassroomProgress(tx, classroomId);
  });

  return { success: true };
}

const setGroupPhaseStatusSchema = z.object({
  groupId: z.string().min(1),
  phaseId: z.string().min(1),
  status: z.enum(PHASE_STATUSES),
});

/**
 * D-3: a teacher manually sets one group's status for one classroom phase
 * (unlock / mark completed / lock). No automatic follow-up logic.
 */
export async function setGroupPhaseStatus(input: z.infer<typeof setGroupPhaseStatusSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = setGroupPhaseStatusSchema.parse(input);

  const [group, phase] = await Promise.all([
    db.query.groups.findFirst({ where: eq(groups.id, data.groupId), columns: { classroomId: true } }),
    db.query.phases.findFirst({ where: eq(phases.id, data.phaseId), columns: { classroomId: true } }),
  ]);
  if (!group || !phase || group.classroomId !== phase.classroomId) {
    throw new Error('Group and phase must belong to the same classroom');
  }
  await assertClassroomEditor(phase.classroomId, userId);

  await db
    .insert(groupPhaseProgress)
    .values({ groupId: data.groupId, phaseId: data.phaseId, status: data.status })
    .onConflictDoUpdate({
      target: [groupPhaseProgress.groupId, groupPhaseProgress.phaseId],
      set: { status: data.status, updatedAt: new Date() },
    });

  return { success: true };
}
