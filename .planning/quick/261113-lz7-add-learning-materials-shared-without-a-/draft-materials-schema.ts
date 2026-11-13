import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';
import { classrooms } from './classrooms';
import { phases } from './phases';

/**
 * Learning materials ("สื่อการเรียน", quick task 261113-lz7): teacher-shared content with NO
 * submission. Belongs to a classroom; phase_id null = whole classroom, otherwise shown under that phase.
 * Never part of progress / phase unlocking. Visible to every member of the classroom.
 */
export const materials = pgTable(
  'materials',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    classroomId: text('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    phaseId: text('phase_id').references(() => phases.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    linkUrl: text('link_url'),
    orderIndex: integer('order_index').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('materials_classroom_id_idx').on(t.classroomId), index('materials_phase_id_idx').on(t.phaseId)],
);

/** Files of a material. Keys live under materials/{materialId}/ and are never shared with other rows. */
export const materialFiles = pgTable(
  'material_files',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileKey: text('file_key').notNull(),
    contentType: text('content_type').notNull(),
    fileSize: integer('file_size').notNull(),
    uploadedBy: text('uploaded_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('material_files_material_id_idx').on(t.materialId)],
);
