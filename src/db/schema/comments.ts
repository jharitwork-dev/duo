import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';
import { submissions } from './submissions';

export const comments = pgTable('comments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  submissionId: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
