import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';
import { FILE_REQUIREMENTS } from '@/lib/work-page';
import { phases } from './phases';

/**
 * Classroom-level task ("งานของห้องเรียน", quick task 261004-j6h).
 * Defined once per phase and materialized as one `todos` row per group (todos.classroom_task_id).
 * Title, deadline and submission mode are locked to the classroom; description, notes,
 * file requirement and files sync to copies unless overridden (todos.overridden_fields).
 */
export const classroomTasks = pgTable(
  'classroom_tasks',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    phaseId: text('phase_id').notNull().references(() => phases.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    notes: text('notes'),
    submissionMode: text('submission_mode', { enum: ['group', 'individual'] }).notNull().default('group'),
    fileRequirement: text('file_requirement', { enum: FILE_REQUIREMENTS }).notNull().default('optional'),
    deadline: timestamp('deadline'),
    orderIndex: integer('order_index').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('classroom_tasks_phase_id_idx').on(t.phaseId)],
);

/** Teacher files attached to a classroom task; copies get todo_attachments rows sharing file_key. */
export const classroomTaskFiles = pgTable(
  'classroom_task_files',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    classroomTaskId: text('classroom_task_id')
      .notNull()
      .references(() => classroomTasks.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileKey: text('file_key').notNull(),
    contentType: text('content_type').notNull(),
    fileSize: integer('file_size').notNull(),
    uploadedBy: text('uploaded_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('classroom_task_files_task_id_idx').on(t.classroomTaskId)],
);
