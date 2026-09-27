import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';

export const phaseTemplates = pgTable('phase_templates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  isBuiltIn: boolean('is_built_in').notNull().default(false),
  createdBy: text('created_by'),
  structure: text('structure').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
