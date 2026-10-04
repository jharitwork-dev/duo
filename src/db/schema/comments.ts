import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';
import { submissions } from './submissions';
import { workPages } from './workPages';

/**
 * Task discussion thread messages (quick task 261004-fgj).
 * Every new comment belongs to a work page (one thread per (to-do, group) or (to-do, student)).
 * submission_id is optional "written at round n" context (latest in-scope submission at posting time);
 * reviewer notes posted by Phase 4 review dialogs also set it to the reviewed submission.
 * author_role is stored at write time (editor → 'teacher') so badges survive classroom changes.
 */
export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    submissionId: text('submission_id').references(() => submissions.id, { onDelete: 'cascade' }),
    // Nullable in the DB (additive migration); always set by the code.
    workPageId: text('work_page_id').references(() => workPages.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    authorRole: text('author_role', { enum: ['teacher', 'student'] }).notNull().default('student'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    editedAt: timestamp('edited_at'),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('comments_work_page_created_idx').on(t.workPageId, t.createdAt),
    index('comments_submission_id_idx').on(t.submissionId),
  ],
);

/** Last time a user looked at a thread (drives the student's unread-teacher-comment dot). */
export const commentReads = pgTable(
  'comment_reads',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull(),
    workPageId: text('work_page_id')
      .notNull()
      .references(() => workPages.id, { onDelete: 'cascade' }),
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('comment_reads_user_page_unique').on(t.userId, t.workPageId)],
);
