import { db } from '@/db';
import { classroomMembers } from '@/db/schema/classrooms';
import { groups, groupMembers } from '@/db/schema/groups';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Returns all groups for a classroom, with member count.
 */
export async function getGroupsByClassroom(classroomId: string) {
  const result = await db
    .select({
      id: groups.id,
      name: groups.name,
      createdBy: groups.createdBy,
      createdAt: groups.createdAt,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM group_members
        WHERE group_members.group_id = "groups"."id"
      )`.mapWith(Number),
    })
    .from(groups)
    .where(eq(groups.classroomId, classroomId));

  return result;
}

/**
 * Returns a single group with its members.
 * Verifies user has access (is a classroom member).
 */
export async function getGroupById(
  groupId: string,
  userId: string,
  opts?: { allowAnyClassroom?: boolean },
) {
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });

  if (!group) {
    return null;
  }

  // Verify user is a classroom member
  const membership = await db.query.classroomMembers.findFirst({
    where: and(
      eq(classroomMembers.classroomId, group.classroomId),
      eq(classroomMembers.userId, userId),
    ),
  });

  // Superadmin callers may open any classroom's group.
  if (!membership && !opts?.allowAnyClassroom) {
    return null;
  }

  // Fetch group members
  const members = await db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  return {
    ...group,
    members,
  };
}

/**
 * Returns the group a student belongs to in a specific classroom, or null.
 */
export async function getStudentGroup(classroomId: string, userId: string) {
  const result = await db
    .select({
      id: groups.id,
      name: groups.name,
      classroomId: groups.classroomId,
      createdAt: groups.createdAt,
      memberId: groupMembers.id,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(
      eq(groups.classroomId, classroomId),
      eq(groupMembers.userId, userId),
    ))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return {
    id: result[0].id,
    name: result[0].name,
    classroomId: result[0].classroomId,
    createdAt: result[0].createdAt,
    joinedAt: result[0].joinedAt,
  };
}
