import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { groups } from '@/db/schema/groups';
import { groupMembers } from '@/db/schema/groups';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { getUserDirectory } from '@/lib/user-directory';

/**
 * Returns all classrooms created by a teacher, with member and group counts.
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
    .where(eq(classrooms.createdBy, userId));

  return result;
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
 * Verifies user is a member (security: Pitfall 2).
 */
export async function getClassroomById(classroomId: string, userId: string) {
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
  if (!membership && classroom.createdBy !== userId) {
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
  };
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
