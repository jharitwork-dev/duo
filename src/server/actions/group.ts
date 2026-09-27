'use server';

import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { groups, groupMembers } from '@/db/schema/groups';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const createGroupSchema = z.object({
  classroomId: z.string().min(1),
  name: z.string().min(1).max(100),
});

export async function createGroup(input: z.infer<typeof createGroupSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = createGroupSchema.parse(input);

  // Verify teacher owns classroom
  const classroom = await db.query.classrooms.findFirst({
    where: and(
      eq(classrooms.id, data.classroomId),
      eq(classrooms.createdBy, userId),
    ),
  });

  if (!classroom) {
    throw new Error('Classroom not found or not authorized');
  }

  const [group] = await db.insert(groups).values({
    classroomId: data.classroomId,
    name: data.name,
    createdBy: userId,
  }).returning({ id: groups.id });

  revalidatePath(`/teacher/classrooms/${data.classroomId}`);
  return { success: true, groupId: group.id };
}

const assignStudentSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
});

export async function assignStudent(input: z.infer<typeof assignStudentSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = assignStudentSchema.parse(input);

  // Get group and its parent classroom
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, data.groupId),
  });

  if (!group) {
    throw new Error('Group not found');
  }

  // Verify teacher owns parent classroom
  const classroom = await db.query.classrooms.findFirst({
    where: and(
      eq(classrooms.id, group.classroomId),
      eq(classrooms.createdBy, currentUserId),
    ),
  });

  if (!classroom) {
    throw new Error('Not authorized for this classroom');
  }

  // Check maxGroupSize
  if (classroom.maxGroupSize) {
    const [memberCount] = await db
      .select({ count: count() })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, data.groupId));

    if (memberCount.count >= classroom.maxGroupSize) {
      throw new Error('Group has reached maximum size');
    }
  }

  await db.insert(groupMembers).values({
    groupId: data.groupId,
    userId: data.userId,
  });

  revalidatePath(`/teacher/classrooms/${group.classroomId}`);
  return { success: true };
}

const joinGroupSchema = z.object({
  groupId: z.string().min(1),
});

export async function joinGroup(input: z.infer<typeof joinGroupSchema>) {
  const userId = await getCurrentUserId();
  const data = joinGroupSchema.parse(input);

  // Get group and parent classroom
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, data.groupId),
  });

  if (!group) {
    throw new Error('Group not found');
  }

  // Verify student is a classroom member
  const membership = await db.query.classroomMembers.findFirst({
    where: and(
      eq(classroomMembers.classroomId, group.classroomId),
      eq(classroomMembers.userId, userId),
    ),
  });

  if (!membership) {
    throw new Error('You are not a member of this classroom');
  }

  // Check if already in a group in this classroom
  const existingGroup = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(
      eq(groups.classroomId, group.classroomId),
      eq(groupMembers.userId, userId),
    ))
    .limit(1);

  if (existingGroup.length > 0) {
    throw new Error('You are already in a group in this classroom');
  }

  // Check maxGroupSize
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, group.classroomId),
  });

  if (classroom?.maxGroupSize) {
    const [memberCount] = await db
      .select({ count: count() })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, data.groupId));

    if (memberCount.count >= classroom.maxGroupSize) {
      throw new Error('Group has reached maximum size');
    }
  }

  await db.insert(groupMembers).values({
    groupId: data.groupId,
    userId,
  });

  revalidatePath(`/student/classrooms/${group.classroomId}`);
  return { success: true };
}

const removeFromGroupSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
});

export async function removeFromGroup(input: z.infer<typeof removeFromGroupSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const data = removeFromGroupSchema.parse(input);

  // Get group to find classroomId for revalidation
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, data.groupId),
  });

  if (!group) {
    throw new Error('Group not found');
  }

  await db.delete(groupMembers)
    .where(and(
      eq(groupMembers.groupId, data.groupId),
      eq(groupMembers.userId, data.userId),
    ));

  revalidatePath(`/teacher/classrooms/${group.classroomId}`);
  return { success: true };
}
