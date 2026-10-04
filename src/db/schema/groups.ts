import { pgTable, text, timestamp, unique, integer } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';
import { classrooms } from './classrooms';

export const groups = pgTable('groups', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Per-group member limit; null = use classrooms.max_group_size (null there = unlimited).
  maxMembers: integer('max_members'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const groupMembers = pgTable('group_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.groupId, t.userId),
]);
