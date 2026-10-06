'use server';

import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { generateUniqueInviteCode } from '@/lib/invite-code';
import { groups, groupMembers, groupTeachers } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { classroomTasks } from '@/db/schema/classroomTasks';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { assertClassroomEditor, cleanupR2Objects, collectFileKeys } from '@/server/phase-helpers';
import { GROUP_MODES, checkDeleteConfirmation } from '@/lib/group-rules';
import { actionError, type ActionResult } from '@/lib/action-result';
import { clerkClient } from '@clerk/nextjs/server';
import {
  ERR_ALREADY_TEACHER,
  canManageClassroomTeachers,
  decideAddTeacher,
  decideRemoveTeacher,
} from '@/lib/classroom-teachers';
import { TEACHER_RANKS, decideSetTeacherRank } from '@/lib/group-teachers';

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

const classroomTeacherSchema = z.object({
  classroomId: z.string().min(1),
  userId: z.string().min(1),
});

/** Loads the classroom and checks the caller is a superadmin or its owner (teacher members are NOT enough). */
async function loadManagedClassroom(
  classroomId: string,
): Promise<{ error: string } | { classroom: { id: string; createdBy: string } }> {
  const role = await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, classroomId),
    columns: { id: true, createdBy: true },
  });
  if (!classroom) return { error: 'ไม่พบห้องเรียน' };
  if (!canManageClassroomTeachers({ role, userId: currentUserId, createdBy: classroom.createdBy })) {
    return { error: 'เฉพาะเจ้าของห้องเรียนหรือแอดมินเท่านั้นที่จัดการครูได้' };
  }
  return { classroom };
}

async function memberRoleOf(classroomId: string, userId: string) {
  const member = await db.query.classroomMembers.findFirst({
    where: and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId)),
    columns: { role: true },
  });
  return member?.role ?? null;
}

/** Adds an approved teacher (global role 'teacher') to the classroom. Owner or superadmin only. */
export async function addClassroomTeacher(input: z.infer<typeof classroomTeacherSchema>): Promise<ActionResult> {
  const parsed = classroomTeacherSchema.safeParse(input);
  if (!parsed.success) return actionError('ข้อมูลไม่ถูกต้อง');
  const data = parsed.data;

  const loaded = await loadManagedClassroom(data.classroomId);
  if ('error' in loaded) return actionError(loaded.error);

  let targetRole: string | null;
  try {
    const user = await (await clerkClient()).users.getUser(data.userId);
    targetRole = (user.publicMetadata as { role?: string } | undefined)?.role ?? null;
  } catch {
    return actionError('ไม่พบผู้ใช้');
  }

  const decision = decideAddTeacher({
    targetRole,
    existingMemberRole: await memberRoleOf(data.classroomId, data.userId),
  });
  if (!decision.ok) return actionError(decision.error);

  try {
    await db.insert(classroomMembers).values({ classroomId: data.classroomId, userId: data.userId, role: 'teacher' });
  } catch {
    // Unique (classroom_id, user_id) — a concurrent add won the race.
    return actionError(ERR_ALREADY_TEACHER);
  }

  revalidateClassroom(data.classroomId);
  revalidatePath('/teacher');
  return { success: true };
}

/** Removes a non-owner teacher from the classroom. Owner or superadmin only. */
export async function removeClassroomTeacher(input: z.infer<typeof classroomTeacherSchema>): Promise<ActionResult> {
  const parsed = classroomTeacherSchema.safeParse(input);
  if (!parsed.success) return actionError('ข้อมูลไม่ถูกต้อง');
  const data = parsed.data;

  const loaded = await loadManagedClassroom(data.classroomId);
  if ('error' in loaded) return actionError(loaded.error);

  const decision = decideRemoveTeacher({
    targetUserId: data.userId,
    createdBy: loaded.classroom.createdBy,
    memberRole: await memberRoleOf(data.classroomId, data.userId),
  });
  if (!decision.ok) return actionError(decision.error);

  // D-04: drop the teacher's group responsibilities in this classroom together with the membership.
  await db.transaction(async (tx) => {
    await tx.delete(groupTeachers).where(and(
      eq(groupTeachers.userId, data.userId),
      inArray(
        groupTeachers.groupId,
        tx.select({ id: groups.id }).from(groups).where(eq(groups.classroomId, data.classroomId)),
      ),
    ));
    await tx.delete(classroomMembers).where(and(
      eq(classroomMembers.classroomId, data.classroomId),
      eq(classroomMembers.userId, data.userId),
      eq(classroomMembers.role, 'teacher'),
    ));
  });

  revalidateClassroom(data.classroomId);
  revalidatePath('/teacher');
  revalidatePath('/teacher/review');
  return { success: true };
}

const setTeacherRankSchema = classroomTeacherSchema.extend({ rank: z.enum(TEACHER_RANKS) });

/** Sets a non-owner teacher's display-only rank (ครู / ผู้ช่วยครู). Owner or superadmin only. */
export async function setClassroomTeacherRank(input: z.infer<typeof setTeacherRankSchema>): Promise<ActionResult> {
  const parsed = setTeacherRankSchema.safeParse(input);
  if (!parsed.success) return actionError('ข้อมูลไม่ถูกต้อง');
  const data = parsed.data;

  const loaded = await loadManagedClassroom(data.classroomId);
  if ('error' in loaded) return actionError(loaded.error);

  const decision = decideSetTeacherRank({
    targetUserId: data.userId,
    createdBy: loaded.classroom.createdBy,
    memberRole: await memberRoleOf(data.classroomId, data.userId),
    rank: data.rank,
  });
  if (!decision.ok) return actionError(decision.error);

  await db.update(classroomMembers).set({ teacherRank: data.rank }).where(and(
    eq(classroomMembers.classroomId, data.classroomId),
    eq(classroomMembers.userId, data.userId),
    eq(classroomMembers.role, 'teacher'),
  ));

  revalidateClassroom(data.classroomId);
  revalidatePath('/teacher/review');
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
    // Classroom tasks (and their files) cascade with the phases (261004-j6h).
    const taskRows = await tx
      .select({ id: classroomTasks.id })
      .from(classroomTasks)
      .innerJoin(phases, eq(phases.id, classroomTasks.phaseId))
      .where(eq(phases.classroomId, classroom.id));
    const fileKeys = await collectFileKeys(tx, {
      todoIds: todoRows.map((t) => t.id),
      classroomTaskIds: taskRows.map((t) => t.id),
    });
    await tx.delete(classrooms).where(eq(classrooms.id, classroom.id));
    return fileKeys;
  });

  await cleanupR2Objects(keys);
  revalidatePath('/teacher');
  revalidatePath('/student');
  return { success: true, name: classroom.name };
}
