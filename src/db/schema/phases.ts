import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';
import { classrooms } from './classrooms';

// Phases belong to the classroom (D-1). Every group sees the same ordered list;
// each group's status for a phase lives in group_phase_progress (D-3).
export const phases = pgTable('phases', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  orderIndex: integer('order_index').notNull().default(0),
  isFreeAccess: boolean('is_free_access').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  deadline: timestamp('deadline'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
