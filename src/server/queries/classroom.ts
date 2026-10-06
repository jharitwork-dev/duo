import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { groups } from '@/db/schema/groups';
import { groupMembers } from '@/db/schema/groups';
import { eq, and, sql, inArray, or, desc } from 'drizzle-orm';
import { getUserDirectory } from '@/lib/user-directory';

/** Subquery: ids of classrooms where the user holds a 'teacher' membership row. */
export function teacherMemberClassroomIds(userId: string) {
  return db
    .select({ id: classroomMembers.classroomId })
    .from(classroomMembers)
    .where(and(eq(classroomMembers.userId, userId), eq(classroomMembers.role, 'teacher')));
}

/**
 * Returns all classrooms created by OR teacher member of the user, with member and group counts.
 */
export async function getTeacherClassrooms(userId: string) {
  const result = await db
    .select({
      id: classrooms.id,
      name: classrooms.name,
      description: classrooms.description,
      inviteCode: classrooms.inviteCode,
      maxGroupSize: classrooms.maxGroupSize,
      isArchived: classrooms.isArchived,
      createdAt: classrooms.createdAt,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM classroom_members
        WHERE classroom_members.classroom_id = "classrooms"."id"
      )`.mapWith(Number),
      groupCount: sql<number>`(
        SELECT COUNT(*) FROM groups
        WHERE groups.classroom_id = "classrooms"."id"
      )`.mapWith(Number),
    })
    .from(classrooms)
    .where(or(eq(classrooms.createdBy, userId), inArray(classrooms.id, teacherMemberClassroomIds(userId))));

  return result;
}

/** Every classroom (superadmin /admin list) with the owner's display name, newest first. */
export async function getAllClassroomsForAdmin() {
  const rows = await db
    .select({
      id: classrooms.id,
      name: classrooms.name,
      isArchived: classrooms.isArchived,
      createdBy: classrooms.createdBy,
      createdAt: classrooms.createdAt,
    })
    .from(classrooms)
    .orderBy(desc(classrooms.createdAt));
  const directory = await getUserDirectory(rows.map((r) => r.createdBy));
  return rows.map((r) => ({ ...r, ownerName: directory.get(r.createdBy)?.name ?? 'ไม่ระบุชื่อ' }));
}

/**
 * Returns all classrooms a student is a member of, with group info.
 */
export async function getStudentClassrooms(userId: string) {
  const result = await db
    .select({
      id: classrooms.id,
      name: classrooms.name,
      description: classrooms.description,
      isArchived: classrooms.isArchived,
      createdAt: classrooms.createdAt,
      role: classroomMembers.role,
      joinedAt: classroomMembers.joinedAt,
      groupCount: sql<number>`(
        SELECT COUNT(*) FROM groups
        WHERE groups.classroom_id = "classrooms"."id"
      )`.mapWith(Number),
    })
    .from(classroomMembers)
    .innerJoin(classrooms, eq(classrooms.id, classroomMembers.classroomId))
    .where(eq(classroomMembers.userId, userId));

  return result;
}

/**
 * Returns a single classroom with groups and members.
 * Verifies user is a member (security: Pitfall 2) unless `allowAnyClassroom` (superadmin callers only).
 */
export async function getClassroomById(
  classroomId: string,
  userId: string,
  opts?: { allowAnyClassroom?: boolean },
) {
  // Verify user is a member or the creator
  const membership = await db.query.classroomMembers.findFirst({
    where: and(
      eq(classroomMembers.classroomId, classroomId),
      eq(classroomMembers.userId, userId),
    ),
  });

  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, classroomId),
  });

  if (!classroom) {
    return null;
  }

  // Allow access if member or creator
  if (!opts?.allowAnyClassroom && !membership && classroom.createdBy !== userId) {
    return null;
  }

  // Fetch groups with member counts
  const classroomGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      maxMembers: groups.maxMembers,
      createdBy: groups.createdBy,
      createdAt: groups.createdAt,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM group_members
        WHERE group_members.group_id = "groups"."id"
      )`.mapWith(Number),
    })
    .from(groups)
    .where(eq(groups.classroomId, classroomId));

  // Fetch members
  const members = await db
    .select({
      id: classroomMembers.id,
      userId: classroomMembers.userId,
      role: classroomMembers.role,
      joinedAt: classroomMembers.joinedAt,
    })
    .from(classroomMembers)
    .where(eq(classroomMembers.classroomId, classroomId));

  // Group membership (for showing member names on group cards)
  const groupIds = classroomGroups.map((g) => g.id);
  const memberships = groupIds.length
    ? await db
        .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
        .from(groupMembers)
        .where(inArray(groupMembers.groupId, groupIds))
    : [];

  // Resolve Clerk names so teachers never see raw user ids
  const directory = await getUserDirectory([
    ...members.map((m) => m.userId),
    ...memberships.map((m) => m.userId),
    classroom.createdBy,
  ]);
  const display = (userId: string) => directory.get(userId)!;

  return {
    ...classroom,
    groups: classroomGroups.map((group) => ({
      ...group,
      members: memberships
        .filter((m) => m.groupId === group.id)
        .map((m) => ({ userId: m.userId, ...display(m.userId) })),
    })),
    members: members.map((member) => ({ ...member, ...display(member.userId) })),
    // Owner shown even when a legacy classroom has no owner member row.
    owner: { userId: classroom.createdBy, ...display(classroom.createdBy) },
  };
}

/** Grouping mode of a classroom (light query for the student group page). */
export async function getClassroomGroupMode(classroomId: string) {
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, classroomId),
    columns: { groupMode: true },
  });
  return classroom?.groupMode ?? null;
}

/**
 * Returns classroom id and name for the join flow (by invite code).
 */
export async function getClassroomByInviteCode(code: string) {
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.inviteCode, code.toUpperCase()),
    columns: {
      id: true,
      name: true,
      description: true,
    },
  });

  return classroom ?? null;
}
