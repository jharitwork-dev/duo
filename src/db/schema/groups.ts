import { pgTable, text, timestamp, unique, integer, index } from 'drizzle-orm/pg-core';
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

// Responsible teachers ("ครูที่ดูแล"): many-to-many group <-> classroom teacher (owner or teacher member).
export const groupTeachers = pgTable('group_teachers', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.groupId, t.userId),
  index('group_teachers_user_id_idx').on(t.userId),
]);
