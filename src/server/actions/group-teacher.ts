'use server';

// Responsible teachers ("ครูที่ดูแล") — quick task 261006-ij6.

import { db } from '@/db';
import { classroomMembers, classrooms } from '@/db/schema/classrooms';
import { groups, groupTeachers } from '@/db/schema/groups';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { actionError, type ActionResult } from '@/lib/action-result';
import { canManageClassroomTeachers } from '@/lib/classroom-teachers';
import { ERR_SELF_NOT_TEACHER, decideGroupTeacherChange, isClassroomTeacher } from '@/lib/group-teachers';

const setGroupTeacherSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
  responsible: z.boolean(),
});

async function memberRoleOf(classroomId: string, userId: string) {
  const member = await db.query.classroomMembers.findFirst({
    where: and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId)),
    columns: { role: true },
  });
  return member?.role ?? null;
}

/**
 * Marks/unmarks a teacher as responsible for a group.
 * Classroom teachers may change themselves (D-02); owner/superadmin may change any classroom teacher (D-03).
 */
export async function setGroupTeacher(input: z.infer<typeof setGroupTeacherSchema>): Promise<ActionResult> {
  const parsed = setGroupTeacherSchema.safeParse(input);
  if (!parsed.success) return actionError('ข้อมูลไม่ถูกต้อง');
  const data = parsed.data;

  const role = await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const actor = await getCurrentUserId();

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, data.groupId),
    columns: { id: true, classroomId: true },
  });
  if (!group) return actionError('ไม่พบกลุ่ม');

  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, group.classroomId),
    columns: { createdBy: true },
  });
  if (!classroom) return actionError('ไม่พบห้องเรียน');
  const createdBy = classroom.createdBy;

  const canManage = canManageClassroomTeachers({ role, userId: actor, createdBy });
  if (
    role !== ROLES.SUPERADMIN &&
    !isClassroomTeacher({ userId: actor, createdBy, memberRole: await memberRoleOf(group.classroomId, actor) })
  ) {
    return actionError(ERR_SELF_NOT_TEACHER);
  }

  // Unassigning is always allowed for a valid actor so stale rows can be cleaned up.
  const targetIsClassroomTeacher = data.responsible
    ? isClassroomTeacher({
        userId: data.userId,
        createdBy,
        memberRole: await memberRoleOf(group.classroomId, data.userId),
      })
    : true;

  const decision = decideGroupTeacherChange({
    actorUserId: actor,
    targetUserId: data.userId,
    canManage,
    targetIsClassroomTeacher,
  });
  if (!decision.ok) return actionError(decision.error);

  if (data.responsible) {
    await db.insert(groupTeachers).values({ groupId: group.id, userId: data.userId }).onConflictDoNothing();
  } else {
    await db
      .delete(groupTeachers)
      .where(and(eq(groupTeachers.groupId, group.id), eq(groupTeachers.userId, data.userId)));
  }

  const classroomId = group.classroomId;
  revalidatePath(`/teacher/classroom/${classroomId}`);
  revalidatePath(`/teacher/classroom/${classroomId}/group/${group.id}`);
  revalidatePath(`/student/classroom/${classroomId}/group/${group.id}`);
  revalidatePath('/teacher/review');
  revalidatePath('/teacher');
  return { success: true };
}
