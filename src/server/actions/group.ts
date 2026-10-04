'use server';

import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { groups, groupMembers } from '@/db/schema/groups';
import { todos } from '@/db/schema/todos';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { eq, and, count, ne, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  assertClassroomEditor,
  assertGroupEditor,
  authorizeGroupDelete,
  cleanupR2Objects,
  collectFileKeys,
  countGroupSubmissions,
  syncClassroomProgress,
  syncClassroomTasks,
  type DbLike,
} from '@/server/phase-helpers';
import {
  MAX_GROUP_LIMIT,
  canStudentCreateGroup,
  canStudentJoinGroup,
  canStudentLeaveGroup,
  checkDeleteConfirmation,
  effectiveGroupLimit,
  groupFullError,
  limitWarning,
} from '@/lib/group-rules';
import { actionError, type ActionResult } from '@/lib/action-result';

const maxMembersSchema = z.number().int().min(1).max(MAX_GROUP_LIMIT).nullable();

function revalidateClassroom(classroomId: string, groupId?: string) {
  revalidatePath(`/teacher/classroom/${classroomId}`);
  revalidatePath(`/student/classroom/${classroomId}`);
  if (groupId) {
    revalidatePath(`/teacher/classroom/${classroomId}/group/${groupId}`);
    revalidatePath(`/student/classroom/${classroomId}/group/${groupId}`);
  }
  revalidatePath('/student');
}

/** Error class for expected limit / membership failures raised inside a transaction. */
class GroupRuleError extends Error {}

/** Group id of the user's current group in a classroom (first one), or null. */
async function currentGroupOf(tx: DbLike, classroomId: string, userId: string): Promise<string | null> {
  const [row] = await tx
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groups.classroomId, classroomId), eq(groupMembers.userId, userId)))
    .limit(1);
  return row?.groupId ?? null;
}

/**
 * Locks the group row (FOR UPDATE, serializing concurrent joins of the same group), counts its
 * members and inserts the user when the effective limit allows. Throws GroupRuleError when full.
 */
async function insertMemberWithLimit(
  tx: DbLike,
  input: { groupId: string; userId: string; classroomMaxGroupSize: number | null },
) {
  const [group] = await tx.select().from(groups).where(eq(groups.id, input.groupId)).for('update');
  if (!group) throw new GroupRuleError('ไม่พบกลุ่มนี้');
  const [row] = await tx
    .select({ n: count() })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, input.groupId));
  const memberCount = row?.n ?? 0;
  const limit = effectiveGroupLimit(group.maxMembers, input.classroomMaxGroupSize);
  if (limit !== null && memberCount >= limit) throw new GroupRuleError(groupFullError(memberCount, limit));
  await tx.insert(groupMembers).values({ groupId: input.groupId, userId: input.userId });
}

/**
 * Locks the user's classroom_members row (FOR UPDATE) so concurrent join / create / assign / move
 * calls for the same student serialize; returns false when they are not a student of the classroom.
 */
async function lockClassroomStudent(tx: DbLike, classroomId: string, userId: string): Promise<boolean> {
  const [member] = await tx
    .select({ role: classroomMembers.role })
    .from(classroomMembers)
    .where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId)))
    .for('update');
  return member?.role === 'student';
}

const NOT_A_STUDENT = 'ผู้ใช้นี้ไม่ได้เป็นนักเรียนในห้องเรียนนี้';
const NOT_YOUR_CLASSROOM = 'คุณไม่ได้เป็นนักเรียนในห้องเรียนนี้';

function ruleError(err: unknown): { success: false; error: string } {
  if (err instanceof GroupRuleError) return actionError(err.message);
  throw err;
}

// ---------------------------------------------------------------------------------------------
// Teacher: create / update / delete groups
// ---------------------------------------------------------------------------------------------

const createGroupSchema = z.object({
  classroomId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  maxMembers: maxMembersSchema.optional(),
});

export async function createGroup(
  input: z.infer<typeof createGroupSchema>,
): Promise<ActionResult<{ groupId: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return actionError('ชื่อกลุ่มต้องมี 1–100 ตัวอักษร และจำนวนสมาชิกสูงสุด 1–50 คน');
  const data = parsed.data;
  await assertClassroomEditor(data.classroomId, userId);

  const groupId = await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({
        classroomId: data.classroomId,
        name: data.name,
        maxMembers: data.maxMembers ?? null,
        createdBy: userId,
      })
      .returning({ id: groups.id });
    // Give the new group its default phase progress rows (first phase active, rest locked).
    await syncClassroomProgress(tx, data.classroomId);
    // Copies of every classroom-level task (261004-j6h); inserts only, so no R2 keys to clean.
    await syncClassroomTasks(tx, data.classroomId);
    return group.id;
  });

  revalidateClassroom(data.classroomId);
  return { success: true, groupId };
}

const updateGroupSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  maxMembers: maxMembersSchema.optional(),
});

export async function updateGroup(
  input: z.infer<typeof updateGroupSchema>,
): Promise<ActionResult<{ warning?: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = updateGroupSchema.safeParse(input);
  if (!parsed.success) return actionError('ชื่อกลุ่มต้องมี 1–100 ตัวอักษร และจำนวนสมาชิกสูงสุด 1–50 คน');
  const data = parsed.data;
  const { group, classroom } = await assertGroupEditor(data.groupId, userId);

  const updates: Partial<typeof groups.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.maxMembers !== undefined) updates.maxMembers = data.maxMembers;
  await db.update(groups).set(updates).where(eq(groups.id, group.id));

  const [row] = await db.select({ n: count() }).from(groupMembers).where(eq(groupMembers.groupId, group.id));
  const newLimit = effectiveGroupLimit(
    data.maxMembers !== undefined ? data.maxMembers : group.maxMembers,
    classroom.maxGroupSize,
  );
  const warning = limitWarning(newLimit, row?.n ?? 0) ?? undefined;

  revalidateClassroom(group.classroomId, group.id);
  return { success: true, warning };
}

const deleteGroupSchema = z.object({
  groupId: z.string().min(1),
  confirmName: z.string().optional(),
});

/**
 * Deletes a group with its memberships, to-dos (and their submissions/files/comments) and phase
 * progress. Allowed for classroom editors, or for the student who created it in self_create mode
 * while it has no submissions (see authorizeGroupDelete). R2 objects are removed after commit.
 */
export async function deleteGroup(
  input: z.infer<typeof deleteGroupSchema>,
): Promise<ActionResult<{ classroomId: string; name: string }>> {
  const userId = await getCurrentUserId();
  const data = deleteGroupSchema.parse(input);
  const { group, decision, submissionCount } = await authorizeGroupDelete(data.groupId, userId);
  if (!decision.ok) return actionError(decision.error);
  if (decision.requiresConfirmation) {
    const confirmation = checkDeleteConfirmation({
      submissionCount,
      expectedName: group.name,
      typed: data.confirmName,
    });
    if (!confirmation.ok) return actionError(confirmation.error);
  }

  let keys: string[];
  try {
    keys = await db.transaction(async (tx) => {
      // Lock the group so no member joins / submission lands between the checks and the delete.
      const [locked] = await tx.select().from(groups).where(eq(groups.id, group.id)).for('update');
      if (!locked) throw new GroupRuleError('ไม่พบกลุ่มนี้ (อาจถูกลบไปแล้ว)');
      if (!decision.requiresConfirmation) {
        // Re-check inside the tx: a submission may have arrived after the authorization check.
        if ((await countGroupSubmissions(tx, group.id)) > 0) {
          throw new GroupRuleError('กลุ่มนี้เพิ่งมีการส่งงาน — โปรดลองลบอีกครั้งเพื่อยืนยัน');
        }
      }
      const todoRows = await tx.select({ id: todos.id }).from(todos).where(eq(todos.groupId, group.id));
      const fileKeys = await collectFileKeys(tx, { todoIds: todoRows.map((t) => t.id) });
      // Cascades: group_members, todos -> submissions -> files/comments, todo_attachments, group_phase_progress.
      await tx.delete(groups).where(eq(groups.id, group.id));
      await syncClassroomProgress(tx, group.classroomId);
      return fileKeys;
    });
  } catch (err) {
    return ruleError(err);
  }

  await cleanupR2Objects(keys);
  revalidateClassroom(group.classroomId, group.id);
  return { success: true, classroomId: group.classroomId, name: group.name };
}

// ---------------------------------------------------------------------------------------------
// Teacher: assign / move / remove members
// ---------------------------------------------------------------------------------------------

const assignStudentSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
});

export async function assignStudent(input: z.infer<typeof assignStudentSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = assignStudentSchema.parse(input);
  const { group, classroom } = await assertGroupEditor(data.groupId, currentUserId);

  try {
    await db.transaction(async (tx) => {
      if (!(await lockClassroomStudent(tx, classroom.id, data.userId))) throw new GroupRuleError(NOT_A_STUDENT);
      const existing = await currentGroupOf(tx, classroom.id, data.userId);
      if (existing === group.id) throw new GroupRuleError('นักเรียนอยู่ในกลุ่มนี้แล้ว');
      if (existing) throw new GroupRuleError('นักเรียนอยู่ในกลุ่มอื่นแล้ว — ใช้ย้ายกลุ่ม');
      await insertMemberWithLimit(tx, {
        groupId: group.id,
        userId: data.userId,
        classroomMaxGroupSize: classroom.maxGroupSize,
      });
    });
  } catch (err) {
    return ruleError(err);
  }

  revalidateClassroom(classroom.id, group.id);
  return { success: true };
}

const moveStudentSchema = z.object({
  classroomId: z.string().min(1),
  userId: z.string().min(1),
  toGroupId: z.string().min(1),
});

/** Moves a student into toGroupId, removing them from any other group of the classroom (one tx). */
export async function moveStudent(input: z.infer<typeof moveStudentSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = moveStudentSchema.parse(input);
  const { group, classroom } = await assertGroupEditor(data.toGroupId, currentUserId);
  if (group.classroomId !== data.classroomId) throw new Error('Group does not belong to this classroom');

  try {
    await db.transaction(async (tx) => {
      if (!(await lockClassroomStudent(tx, classroom.id, data.userId))) throw new GroupRuleError(NOT_A_STUDENT);
      const otherGroupIds = tx
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.classroomId, classroom.id), ne(groups.id, group.id)));
      await tx
        .delete(groupMembers)
        .where(and(eq(groupMembers.userId, data.userId), inArray(groupMembers.groupId, otherGroupIds)));

      const [already] = await tx
        .select({ id: groupMembers.id })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, data.userId)))
        .limit(1);
      if (already) return;
      await insertMemberWithLimit(tx, {
        groupId: group.id,
        userId: data.userId,
        classroomMaxGroupSize: classroom.maxGroupSize,
      });
    });
  } catch (err) {
    return ruleError(err);
  }

  revalidateClassroom(classroom.id, group.id);
  return { success: true };
}

const removeFromGroupSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
});

export async function removeFromGroup(input: z.infer<typeof removeFromGroupSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = removeFromGroupSchema.parse(input);
  const { group } = await assertGroupEditor(data.groupId, currentUserId);

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, data.userId)));

  revalidateClassroom(group.classroomId, group.id);
  return { success: true };
}

// ---------------------------------------------------------------------------------------------
// Student: join / create / leave (governed by classrooms.group_mode)
// ---------------------------------------------------------------------------------------------

const joinGroupSchema = z.object({
  groupId: z.string().min(1),
});

export async function joinGroup(input: z.infer<typeof joinGroupSchema>): Promise<ActionResult<{ groupId: string }>> {
  const userId = await getCurrentUserId();
  const data = joinGroupSchema.parse(input);

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, data.groupId),
    with: { classroom: true },
  });
  if (!group) return actionError('ไม่พบกลุ่มนี้');
  const classroom = group.classroom;

  try {
    await db.transaction(async (tx) => {
      if (!(await lockClassroomStudent(tx, classroom.id, userId))) throw new GroupRuleError(NOT_YOUR_CLASSROOM);
      // Lock the group too so the count used by the rule is the one we insert against.
      const [locked] = await tx.select().from(groups).where(eq(groups.id, group.id)).for('update');
      if (!locked) throw new GroupRuleError('ไม่พบกลุ่มนี้');
      const [row] = await tx.select({ n: count() }).from(groupMembers).where(eq(groupMembers.groupId, group.id));
      const verdict = canStudentJoinGroup({
        mode: classroom.groupMode,
        hasGroup: (await currentGroupOf(tx, classroom.id, userId)) !== null,
        memberCount: row?.n ?? 0,
        limit: effectiveGroupLimit(locked.maxMembers, classroom.maxGroupSize),
      });
      if (!verdict.ok) throw new GroupRuleError(verdict.error);
      await tx.insert(groupMembers).values({ groupId: group.id, userId });
    });
  } catch (err) {
    return ruleError(err);
  }

  revalidateClassroom(classroom.id, group.id);
  return { success: true, groupId: group.id };
}

const createGroupAsStudentSchema = z.object({
  classroomId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
});

export async function createGroupAsStudent(
  input: z.infer<typeof createGroupAsStudentSchema>,
): Promise<ActionResult<{ groupId: string }>> {
  const userId = await getCurrentUserId();
  const parsed = createGroupAsStudentSchema.safeParse(input);
  if (!parsed.success) return actionError('ชื่อกลุ่มต้องมี 1–100 ตัวอักษร');
  const data = parsed.data;

  const classroom = await db.query.classrooms.findFirst({ where: eq(classrooms.id, data.classroomId) });
  if (!classroom) return actionError('ไม่พบห้องเรียนนี้');

  let groupId: string;
  try {
    groupId = await db.transaction(async (tx) => {
      if (!(await lockClassroomStudent(tx, classroom.id, userId))) throw new GroupRuleError(NOT_YOUR_CLASSROOM);
      const verdict = canStudentCreateGroup({
        mode: classroom.groupMode,
        hasGroup: (await currentGroupOf(tx, classroom.id, userId)) !== null,
      });
      if (!verdict.ok) throw new GroupRuleError(verdict.error);
      const [group] = await tx
        .insert(groups)
        .values({ classroomId: classroom.id, name: data.name, maxMembers: null, createdBy: userId })
        .returning({ id: groups.id });
      await tx.insert(groupMembers).values({ groupId: group.id, userId });
      await syncClassroomProgress(tx, classroom.id);
      // Copies of every classroom-level task (261004-j6h); inserts only, so no R2 keys to clean.
      await syncClassroomTasks(tx, classroom.id);
      return group.id;
    });
  } catch (err) {
    return ruleError(err);
  }

  revalidateClassroom(classroom.id, groupId);
  return { success: true, groupId };
}

const leaveGroupSchema = z.object({
  groupId: z.string().min(1),
});

export async function leaveGroup(
  input: z.infer<typeof leaveGroupSchema>,
): Promise<ActionResult<{ classroomId: string }>> {
  const userId = await getCurrentUserId();
  const data = leaveGroupSchema.parse(input);

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, data.groupId),
    with: { classroom: true },
  });
  if (!group) return actionError('ไม่พบกลุ่มนี้');
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
    columns: { id: true },
  });
  if (!membership) return actionError('คุณไม่ได้เป็นสมาชิกของกลุ่มนี้');

  const verdict = canStudentLeaveGroup({
    mode: group.classroom.groupMode,
    groupHasSubmissions: (await countGroupSubmissions(db, group.id)) > 0,
  });
  if (!verdict.ok) return actionError(verdict.error);

  await db.delete(groupMembers).where(eq(groupMembers.id, membership.id));

  revalidateClassroom(group.classroomId, group.id);
  return { success: true, classroomId: group.classroomId };
}
