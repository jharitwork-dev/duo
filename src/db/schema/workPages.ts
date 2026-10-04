import { pgTable, text, timestamp, integer, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@/lib/ids';
import type { WorkPageDoc } from '@/lib/work-page';
import { todos } from './todos';
import { groups } from './groups';

/**
 * Student work page per to-do (quick task 261004-01i).
 * Owner key (see workPageOwnerKey): group to-do → (todo, group, user NULL); individual → (todo, group, user).
 * group_id is always stored so teachers can list pages by group.
 */
export const workPages = pgTable(
  'work_pages',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    todoId: text('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    content: jsonb('content').$type<WorkPageDoc>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: text('updated_by'),
  },
  (t) => [
    uniqueIndex('work_pages_todo_group_unique').on(t.todoId, t.groupId).where(sql`${t.userId} is null`),
    uniqueIndex('work_pages_todo_user_unique').on(t.todoId, t.userId).where(sql`${t.userId} is not null`),
  ],
);

export const workPageFiles = pgTable(
  'work_page_files',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    workPageId: text('work_page_id').notNull().references(() => workPages.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileKey: text('file_key').notNull(),
    contentType: text('content_type').notNull(),
    fileSize: integer('file_size').notNull(),
    uploadedBy: text('uploaded_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('work_page_files_work_page_id_idx').on(t.workPageId)],
);
