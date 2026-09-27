'use server';

import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { generateUniqueInviteCode } from '@/lib/invite-code';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

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

  // Verify teacher owns classroom
  const classroom = await db.query.classrooms.findFirst({
    where: and(
      eq(classrooms.id, data.classroomId),
      eq(classrooms.createdBy, currentUserId),
    ),
  });

  if (!classroom) {
    throw new Error('Classroom not found or not authorized');
  }

  await db.insert(classroomMembers).values({
    classroomId: data.classroomId,
    userId: data.userId,
    role: 'student',
  });

  revalidatePath(`/teacher/classrooms/${data.classroomId}`);
  return { success: true };
}

const updateSettingsSchema = z.object({
  classroomId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  maxGroupSize: z.number().int().min(1).max(50).nullable().optional(),
});

export async function updateClassroomSettings(input: z.infer<typeof updateSettingsSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = updateSettingsSchema.parse(input);

  // Verify teacher owns classroom
  const classroom = await db.query.classrooms.findFirst({
    where: and(
      eq(classrooms.id, data.classroomId),
      eq(classrooms.createdBy, currentUserId),
    ),
  });

  if (!classroom) {
    throw new Error('Classroom not found or not authorized');
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.maxGroupSize !== undefined) updates.maxGroupSize = data.maxGroupSize;

  await db.update(classrooms)
    .set(updates)
    .where(eq(classrooms.id, data.classroomId));

  revalidatePath(`/teacher/classrooms/${data.classroomId}`);
  return { success: true };
}

const regenerateCodeSchema = z.object({
  classroomId: z.string().min(1),
});

export async function regenerateInviteCode(input: z.infer<typeof regenerateCodeSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = regenerateCodeSchema.parse(input);

  // Verify teacher owns classroom
  const classroom = await db.query.classrooms.findFirst({
    where: and(
      eq(classrooms.id, data.classroomId),
      eq(classrooms.createdBy, currentUserId),
    ),
  });

  if (!classroom) {
    throw new Error('Classroom not found or not authorized');
  }

  const newCode = await generateUniqueInviteCode();

  await db.update(classrooms)
    .set({ inviteCode: newCode, updatedAt: new Date() })
    .where(eq(classrooms.id, data.classroomId));

  revalidatePath(`/teacher/classrooms/${data.classroomId}`);
  return { success: true, inviteCode: newCode };
}

const removeStudentSchema = z.object({
  classroomId: z.string().min(1),
  userId: z.string().min(1),
});

export async function removeStudent(input: z.infer<typeof removeStudentSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const currentUserId = await getCurrentUserId();
  const data = removeStudentSchema.parse(input);

  // Verify teacher owns classroom
  const classroom = await db.query.classrooms.findFirst({
    where: and(
      eq(classrooms.id, data.classroomId),
      eq(classrooms.createdBy, currentUserId),
    ),
  });

  if (!classroom) {
    throw new Error('Classroom not found or not authorized');
  }

  await db.delete(classroomMembers)
    .where(and(
      eq(classroomMembers.classroomId, data.classroomId),
      eq(classroomMembers.userId, data.userId),
    ));

  revalidatePath(`/teacher/classrooms/${data.classroomId}`);
  return { success: true };
}
