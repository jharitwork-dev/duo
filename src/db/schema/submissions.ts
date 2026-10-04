import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import type { WorkPageDoc } from '@/lib/work-page';
import { createId } from '@/lib/ids';
import { todos } from './todos';
import { groups } from './groups';

export const submissions = pgTable('submissions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  todoId: text('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
  submittedBy: text('submitted_by').notNull(),
  groupId: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  textContent: text('text_content'),
  linkUrl: text('link_url'),
  // Snapshot of the work page at submit time (null for legacy file-only submissions).
  content: jsonb('content').$type<WorkPageDoc>(),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const submissionFiles = pgTable('submission_files', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  submissionId: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileKey: text('file_key').notNull(),
  contentType: text('content_type').notNull(),
  fileSize: integer('file_size').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
