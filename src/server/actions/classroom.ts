'use server';

import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { generateUniqueInviteCode } from '@/lib/invite-code';
import { groups, groupMembers } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { assertClassroomEditor, cleanupR2Objects, collectFileKeys } from '@/server/phase-helpers';
import { GROUP_MODES, checkDeleteConfirmation } from '@/lib/group-rules';
import { actionError, type ActionResult } from '@/lib/action-result';

function revalidateClassroom(classroomId: string) {
  revalidatePath(`/teacher/classroom/${classroomId}`);
  revalidatePath(`/student/classroom/${classroomId}`);
}

const createClassroomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxGroupSize: z.number().int().min(1).max(50).optional(),
});

export async function createClassroom(input: z.infer<typeof createClassroomSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = createClassroomSchema.parse(input);

  const inviteCode = await generateUniqueInviteCode();

  const [classroom] = await db.insert(classrooms).values({
    name: data.name,
    description: data.description ?? null,
    maxGroupSize: data.maxGroupSize ?? null,
    inviteCode,
    createdBy: userId,
  }).returning({ id: classrooms.id });

  // Auto-add creator as teacher member
  await db.insert(classroomMembers).values({
    classroomId: classroom.id,
    userId,
    role: 'teacher',
  });

  revalidatePath('/teacher');
  return { success: true, classroomId: classroom.id };
}

const joinByCodeSchema = z.object({
  code: z.string().length(6),
});

export async function joinByCode(input: z.infer<typeof joinByCodeSchema>) {
  const userId = await getCurrentUserId();
  const data = joinByCodeSchema.parse(input);

  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.inviteCode, data.code.toUpperCase()),
  });

  if (!classroom) {
    throw new Error('Invalid invite code');
  }

  // Check if already a member
  const existing = await db.query.classroomMembers.findFirst({
    where: and(
      eq(classroomMembers.classroomId, classroom.id),
      eq(classroomMembers.userId, userId),
    ),
  });

  if (existing) {
    throw new Error('Already a member of this classroom');
  }

  await db.insert(classroomMembers).values({
    classroomId: classroom.id,
    userId,
    role: 'student',
  });

  revalidatePath('/student');
  return { success: true, classroomId: classroom.id };
}

const addStudentSchema = z.object({
  classroomId: z.string().min(1),
  userId: z.string().min(1),
});

export async function addStudent(input: z.infer<typeof addStudentSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = addStudentSchema.parse(input);
  await assertClassroomEditor(data.classroomId, currentUserId);

  await db.insert(classroomMembers).values({
    classroomId: data.classroomId,
    userId: data.userId,
    role: 'student',
  });

  revalidateClassroom(data.classroomId);
  return { success: true };
}

const updateSettingsSchema = z.object({
  classroomId: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  maxGroupSize: z.number().int().min(1).max(50).nullable().optional(),
  groupMode: z.enum(GROUP_MODES).optional(),
});

export async function updateClassroomSettings(input: z.infer<typeof updateSettingsSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) return actionError('ข้อมูลไม่ถูกต้อง: ชื่อ 1–100 ตัวอักษร และขนาดกลุ่ม 1–50 คน');
  const data = parsed.data;
  await assertClassroomEditor(data.classroomId, currentUserId);

  const updates: Partial<typeof classrooms.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.maxGroupSize !== undefined) updates.maxGroupSize = data.maxGroupSize;
  if (data.groupMode !== undefined) updates.groupMode = data.groupMode;

  await db.update(classrooms)
    .set(updates)
    .where(eq(classrooms.id, data.classroomId));

  revalidateClassroom(data.classroomId);
  revalidatePath('/teacher');
  return { success: true };
}

const regenerateCodeSchema = z.object({
  classroomId: z.string().min(1),
});

export async function regenerateInviteCode(input: z.infer<typeof regenerateCodeSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = regenerateCodeSchema.parse(input);
  await assertClassroomEditor(data.classroomId, currentUserId);

  const newCode = await generateUniqueInviteCode();

  await db.update(classrooms)
    .set({ inviteCode: newCode, updatedAt: new Date() })
    .where(eq(classrooms.id, data.classroomId));

  revalidateClassroom(data.classroomId);
  return { success: true, inviteCode: newCode };
}

const removeStudentSchema = z.object({
  classroomId: z.string().min(1),
  userId: z.string().min(1),
});

/** Removes a student from the classroom AND from every group of that classroom (one transaction). */
export async function removeStudent(input: z.infer<typeof removeStudentSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = removeStudentSchema.parse(input);
  await assertClassroomEditor(data.classroomId, currentUserId);

  const member = await db.query.classroomMembers.findFirst({
    where: and(eq(classroomMembers.classroomId, data.classroomId), eq(classroomMembers.userId, data.userId)),
    columns: { role: true },
  });
  if (!member) return actionError('ไม่พบนักเรียนคนนี้ในห้องเรียน');
  if (member.role !== 'student') return actionError('นำได้เฉพาะนักเรียนออกจากห้องเรียน');

  await db.transaction(async (tx) => {
    const classroomGroupIds = tx
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.classroomId, data.classroomId));
    await tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.userId, data.userId), inArray(groupMembers.groupId, classroomGroupIds)));
    await tx.delete(classroomMembers)
      .where(and(
        eq(classroomMembers.classroomId, data.classroomId),
        eq(classroomMembers.userId, data.userId),
      ));
  });

  revalidateClassroom(data.classroomId);
  return { success: true };
}

const setArchivedSchema = z.object({
  classroomId: z.string().min(1),
  archived: z.boolean(),
});

/** Archive (hide from the main list) or restore a classroom; nothing is deleted. */
export async function setClassroomArchived(input: z.infer<typeof setArchivedSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = setArchivedSchema.parse(input);
  await assertClassroomEditor(data.classroomId, currentUserId);

  await db.update(classrooms)
    .set({ isArchived: data.archived, updatedAt: new Date() })
    .where(eq(classrooms.id, data.classroomId));

  revalidateClassroom(data.classroomId);
  revalidatePath('/teacher');
  revalidatePath('/student');
  return { success: true };
}

const deleteClassroomSchema = z.object({
  classroomId: z.string().min(1),
  confirmName: z.string(),
});

/**
 * Permanently deletes a classroom (cascades members, groups, phases, to-dos, submissions, files,
 * comments, progress). Always requires typing the classroom name. R2 objects removed after commit.
 */
export async function deleteClassroom(
  input: z.infer<typeof deleteClassroomSchema>,
): Promise<ActionResult<{ name: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = deleteClassroomSchema.parse(input);
  const classroom = await assertClassroomEditor(data.classroomId, currentUserId);

  const confirmation = checkDeleteConfirmation({
    alwaysRequire: true,
    submissionCount: 0,
    expectedName: classroom.name,
    typed: data.confirmName,
  });
  if (!confirmation.ok) return actionError(confirmation.error);

  const keys = await db.transaction(async (tx) => {
    const todoRows = await tx
      .select({ id: todos.id })
      .from(todos)
      .innerJoin(phases, eq(phases.id, todos.phaseId))
      .where(eq(phases.classroomId, classroom.id));
    const fileKeys = await collectFileKeys(tx, { todoIds: todoRows.map((t) => t.id) });
    await tx.delete(classrooms).where(eq(classrooms.id, classroom.id));
    return fileKeys;
  });

  await cleanupR2Objects(keys);
  revalidatePath('/teacher');
  revalidatePath('/student');
  return { success: true, name: classroom.name };
}
