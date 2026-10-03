import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';
import { groups } from './groups';
import { phases } from './phases';

export const PHASE_STATUSES = ['locked', 'active', 'completed'] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

// One row per (group, classroom phase). A missing row means the default rule:
// first non-archived phase = active, all others = locked.
export const groupPhaseProgress = pgTable('group_phase_progress', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  phaseId: text('phase_id').notNull().references(() => phases.id, { onDelete: 'cascade' }),
  status: text('status', { enum: PHASE_STATUSES }).notNull().default('locked'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.groupId, t.phaseId),
]);
