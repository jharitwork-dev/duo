'use server';

import { z } from 'zod';
import { db } from '@/db';
import { phases } from '@/db/schema/phases';
import { eq, and, max, sql, inArray } from 'drizzle-orm';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

const createPhaseSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function createPhase(input: z.infer<typeof createPhaseSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = createPhaseSchema.parse(input);

  // Get max orderIndex for this group (non-archived only)
  const result = await db
    .select({ maxOrder: max(phases.orderIndex) })
    .from(phases)
    .where(and(eq(phases.groupId, data.groupId), eq(phases.isArchived, false)));

  const nextOrder = (result[0]?.maxOrder ?? -1) + 1;

  // First phase in group is active, rest are locked
  const status = nextOrder === 0 ? 'active' : 'locked';

  const [inserted] = await db
    .insert(phases)
    .values({
      groupId: data.groupId,
      name: data.name,
      description: data.description,
      orderIndex: nextOrder,
      status,
      createdBy: userId,
    })
    .returning({ id: phases.id });

  return { success: true, phaseId: inserted.id };
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
  const data = updatePhaseSchema.parse(input);
  const { phaseId, ...updates } = data;

  // Build update object with only provided fields
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) updateFields.name = updates.name;
  if (updates.description !== undefined) updateFields.description = updates.description;
  if (updates.isFreeAccess !== undefined) updateFields.isFreeAccess = updates.isFreeAccess;
  if (updates.deadline !== undefined) updateFields.deadline = updates.deadline;

  await db.update(phases).set(updateFields).where(eq(phases.id, phaseId));

  return { success: true };
}

const reorderPhasesSchema = z.object({
  groupId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
});

export async function reorderPhases(input: z.infer<typeof reorderPhasesSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const data = reorderPhasesSchema.parse(input);

  // Verify all IDs belong to this group and are not archived
  const existingPhases = await db
    .select({ id: phases.id })
    .from(phases)
    .where(
      and(
        eq(phases.groupId, data.groupId),
        eq(phases.isArchived, false),
        inArray(phases.id, data.orderedIds),
      ),
    );

  if (existingPhases.length !== data.orderedIds.length) {
    throw new Error('Some phase IDs are invalid, archived, or do not belong to this group');
  }

  // Update all orderIndex values atomically in a transaction
  await db.transaction(async (tx) => {
    for (let i = 0; i < data.orderedIds.length; i++) {
      await tx
        .update(phases)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(eq(phases.id, data.orderedIds[i]));
    }
  });

  return { success: true };
}

const archivePhaseSchema = z.object({
  phaseId: z.string().min(1),
});

export async function archivePhase(input: z.infer<typeof archivePhaseSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const data = archivePhaseSchema.parse(input);

  await db
    .update(phases)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(phases.id, data.phaseId));

  return { success: true };
}

const restorePhaseSchema = z.object({
  phaseId: z.string().min(1),
});

export async function restorePhase(input: z.infer<typeof restorePhaseSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const data = restorePhaseSchema.parse(input);

  await db
    .update(phases)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(eq(phases.id, data.phaseId));

  return { success: true };
}
