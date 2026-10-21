import { pgTable, text, timestamp, integer, boolean, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@/lib/ids';
import {
  FORM_STATUSES,
  QUESTION_TYPES,
  RESPONSE_MODES,
  type FormAnswers,
  type QuestionConfig,
} from '@/lib/forms';
import { classrooms } from './classrooms';
import { groups } from './groups';

/**
 * Classroom forms (quick task 261021-r1c): teacher-defined questions, students answer
 * Typeform-style. Migration: src/db/migrations/2026-10-21-forms.ts (hand-written, never drizzle-kit push).
 */
export const forms = pgTable(
  'forms',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    responseMode: text('response_mode', { enum: RESPONSE_MODES }).notNull().default('individual'),
    status: text('status', { enum: FORM_STATUSES }).notNull().default('draft'),
    closesAt: timestamp('closes_at'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('forms_classroom_id_idx').on(t.classroomId)],
);

/** Audience: no rows = whole classroom. */
export const formGroups = pgTable(
  'form_groups',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    formId: text('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
    groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [unique().on(t.formId, t.groupId)],
);

export const formQuestions = pgTable(
  'form_questions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    formId: text('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull().default(0),
    type: text('type', { enum: QUESTION_TYPES }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    required: boolean('required').notNull().default(false),
    config: jsonb('config').$type<QuestionConfig>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('form_questions_form_id_idx').on(t.formId)],
);

/** One response per owner: individual → user id, group → group id (unique(form_id, owner_key)). */
export const formResponses = pgTable(
  'form_responses',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    formId: text('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
    ownerKey: text('owner_key').notNull(),
    // Submitter / last editor.
    userId: text('user_id').notNull(),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
    answers: jsonb('answers').$type<FormAnswers>().notNull().default(sql`'{}'::jsonb`),
    submittedAt: timestamp('submitted_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [unique().on(t.formId, t.ownerKey)],
);
