import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';
import { phases } from './phases';
import { groups } from './groups';

export const todos = pgTable('todos', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  phaseId: text('phase_id').notNull().references(() => phases.id, { onDelete: 'cascade' }),
  // To-dos are per (phase, group) (D-1).
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  // Shared by the independent copies created together by one multi-group assignment (D-2).
  assignmentId: text('assignment_id'),
  title: text('title').notNull(),
  description: text('description'),
  notes: text('notes'),
  orderIndex: integer('order_index').notNull().default(0),
  submissionMode: text('submission_mode', { enum: ['group', 'individual'] }).notNull().default('group'),
  isArchived: boolean('is_archived').notNull().default(false),
  deadline: timestamp('deadline'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const todoAttachments = pgTable('todo_attachments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  todoId: text('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileKey: text('file_key').notNull(),
  contentType: text('content_type').notNull(),
  fileSize: integer('file_size').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
