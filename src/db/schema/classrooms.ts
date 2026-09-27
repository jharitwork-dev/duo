import { pgTable, text, timestamp, unique, integer, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';

export const classrooms = pgTable('classrooms', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  inviteCode: text('invite_code').unique(),
  maxGroupSize: integer('max_group_size'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const classroomMembers = pgTable('classroom_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['teacher', 'student'] }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.classroomId, t.userId),
]);
