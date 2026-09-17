import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';
import { groups } from './groups';

export const phases = pgTable('phases', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  orderIndex: integer('order_index').notNull().default(0),
  status: text('status', { enum: ['locked', 'active', 'completed'] }).notNull().default('locked'),
  isFreeAccess: boolean('is_free_access').notNull().default(false),
  deadline: timestamp('deadline'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
