/**
 * Data migration 2026-10-03 (quick task 261003-wuo): classroom-level phases.
 *
 *   phases.group_id  -> phases.classroom_id (per-group phases merged by trimmed, lower-case name)
 *   phase status col -> group_phase_progress (one row per group x phase)
 *   todos            += group_id (NOT NULL, the old phase's group) + assignment_id (nullable)
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-10-03-classroom-phases.ts --dry-run   # runs everything, then ROLLBACK
 *   npx tsx src/db/migrations/2026-10-03-classroom-phases.ts --apply     # runs everything, then COMMIT
 *
 * WARNING: DATABASE_URL is shared with the LIVE site. Only the orchestrator runs --apply,
 * after reviewing the --dry-run output, immediately before/after deploying the matching code.
 * After --apply, `npx drizzle-kit push` must report no changes (the Drizzle schema matches).
 *
 * Idempotent: if phases.group_id is gone and phases.classroom_id exists, it prints
 * "already migrated" and exits 0. Everything runs in ONE transaction; any failed assertion
 * throws and rolls back.
 */

import { config } from 'dotenv';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';
import { planPhaseMerge, type OldPhaseRow, type MergePhaseStatus } from './phase-merge-plan';
import { createId } from '../../lib/ids';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

neonConfig.webSocketConstructor = ws;

const USAGE = 'Usage: npx tsx src/db/migrations/2026-10-03-classroom-phases.ts (--dry-run | --apply)';

type Counts = { classrooms: number; groups: number; phases: number; todos: number; submissions: number };

async function count(client: PoolClient, table: string): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  return res.rows[0].n as number;
}

async function counts(client: PoolClient): Promise<Counts> {
  return {
    classrooms: await count(client, 'classrooms'),
    groups: await count(client, 'groups'),
    phases: await count(client, 'phases'),
    todos: await count(client, 'todos'),
    submissions: await count(client, 'submissions'),
  };
}

async function columnExists(client: PoolClient, table: string, column: string): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return (res.rowCount ?? 0) > 0;
}

async function constraintExists(client: PoolClient, name: string): Promise<boolean> {
  const res = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [name]);
  return (res.rowCount ?? 0) > 0;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function printCounts(label: string, c: Counts) {
  console.log(
    `${label}: classrooms=${c.classrooms} groups=${c.groups} phases=${c.phases} todos=${c.todos} submissions=${c.submissions}`,
  );
}

async function printBefore(client: PoolClient) {
  const res = await client.query(
    `SELECT c.name AS classroom, g.name AS group_name, p.id, p.name, p.order_index, p.status, p.is_archived,
            (SELECT count(*)::int FROM todos t WHERE t.phase_id = p.id) AS todo_count
       FROM phases p
       JOIN groups g ON g.id = p.group_id
       JOIN classrooms c ON c.id = g.classroom_id
      ORDER BY c.name, g.name, p.order_index`,
  );
  console.log('BEFORE phases (classroom / owning group / phase):');
  if (res.rows.length === 0) console.log('  (none)');
  for (const r of res.rows) {
    console.log(
      `  ${r.classroom} / ${r.group_name} / "${r.name}" id=${r.id} order=${r.order_index} status=${r.status}` +
        `${r.is_archived ? ' archived' : ''} todos=${r.todo_count}`,
    );
  }
}

async function printAfter(client: PoolClient) {
  const phasesRes = await client.query(
    `SELECT c.name AS classroom, p.id, p.name, p.order_index, p.is_archived
       FROM phases p JOIN classrooms c ON c.id = p.classroom_id
      ORDER BY c.name, p.order_index`,
  );
  console.log('AFTER classroom phases:');
  if (phasesRes.rows.length === 0) console.log('  (none)');
  for (const r of phasesRes.rows) {
    console.log(`  ${r.classroom} / #${r.order_index} "${r.name}" id=${r.id}${r.is_archived ? ' archived' : ''}`);
  }

  const progressRes = await client.query(
    `SELECT g.name AS group_name, p.name AS phase_name, gp.status
       FROM group_phase_progress gp
       JOIN groups g ON g.id = gp.group_id
       JOIN phases p ON p.id = gp.phase_id
      ORDER BY g.name, p.order_index`,
  );
  console.log('AFTER group_phase_progress (group / phase / status):');
  if (progressRes.rows.length === 0) console.log('  (none)');
  for (const r of progressRes.rows) console.log(`  ${r.group_name} / "${r.phase_name}" / ${r.status}`);

  const todosRes = await client.query(
    `SELECT g.name AS group_name, p.name AS phase_name, count(*)::int AS n
       FROM todos t
       JOIN groups g ON g.id = t.group_id
       JOIN phases p ON p.id = t.phase_id
      GROUP BY g.name, p.name, p.order_index
      ORDER BY g.name, p.order_index`,
  );
  console.log('AFTER todos per (group, phase):');
  if (todosRes.rows.length === 0) console.log('  (none)');
  for (const r of todosRes.rows) console.log(`  ${r.group_name} / "${r.phase_name}" -> ${r.n}`);
}

async function migrate(client: PoolClient) {
  // 1. Idempotency guard.
  const hasGroupId = await columnExists(client, 'phases', 'group_id');
  const hasClassroomId = await columnExists(client, 'phases', 'classroom_id');
  if (!hasGroupId && hasClassroomId) {
    console.log('already migrated (phases.group_id is gone, phases.classroom_id exists) — nothing to do');
    printCounts('CURRENT', await counts(client));
    return;
  }
  assert(hasGroupId, 'phases.group_id is missing but phases.classroom_id is missing too — unknown schema state');

  // 2. BEFORE summary.
  const before = await counts(client);
  printCounts('BEFORE', before);
  await printBefore(client);

  // 3. New table + nullable columns.
  await client.query(`
    CREATE TABLE IF NOT EXISTS group_phase_progress (
      id text PRIMARY KEY NOT NULL,
      group_id text NOT NULL,
      phase_id text NOT NULL,
      status text DEFAULT 'locked' NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL,
      CONSTRAINT group_phase_progress_group_id_phase_id_unique UNIQUE (group_id, phase_id),
      CONSTRAINT group_phase_progress_group_id_groups_id_fk
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE cascade ON UPDATE no action,
      CONSTRAINT group_phase_progress_phase_id_phases_id_fk
        FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE cascade ON UPDATE no action
    )`);
  await client.query(`ALTER TABLE phases ADD COLUMN IF NOT EXISTS classroom_id text`);
  await client.query(
    `ALTER TABLE todos ADD COLUMN IF NOT EXISTS group_id text, ADD COLUMN IF NOT EXISTS assignment_id text`,
  );

  // 4. Plan and apply the merge.
  const groupsRes = await client.query(`SELECT id, classroom_id FROM groups`);
  const phasesRes = await client.query(
    `SELECT p.id, p.group_id, g.classroom_id, p.name, p.order_index, p.status, p.is_archived, p.created_at
       FROM phases p JOIN groups g ON g.id = p.group_id`,
  );
  assert(phasesRes.rows.length === before.phases, 'every phase must join to a group');

  const plans = planPhaseMerge({
    groups: groupsRes.rows.map((r) => ({ id: r.id as string, classroomId: r.classroom_id as string })),
    phases: phasesRes.rows.map(
      (r): OldPhaseRow => ({
        id: r.id,
        groupId: r.group_id,
        classroomId: r.classroom_id,
        name: r.name,
        orderIndex: r.order_index,
        status: r.status as MergePhaseStatus,
        isArchived: r.is_archived,
        createdAt: new Date(r.created_at),
      }),
    ),
  });

  let todosTouched = 0;
  let progressRows = 0;
  const deleteIds: string[] = [];
  for (const plan of plans) {
    console.log(
      `PLAN classroom=${plan.classroomId}: survivors=${plan.survivors.length} remap=${plan.remap.length} ` +
        `delete=${plan.deletePhaseIds.length} progress=${plan.progress.length}`,
    );
    for (const s of plan.survivors) {
      await client.query(
        `UPDATE phases SET classroom_id = $1, order_index = $2, is_archived = $3, updated_at = now() WHERE id = $4`,
        [plan.classroomId, s.orderIndex, s.isArchived, s.phaseId],
      );
    }
    for (const r of plan.remap) {
      // `group_id IS NULL` guard: a survivor self-entry processed after a merged entry must not
      // overwrite the group_id of to-dos that were just moved onto the survivor.
      const res = await client.query(
        `UPDATE todos SET group_id = $1, phase_id = $2 WHERE phase_id = $3 AND group_id IS NULL`,
        [r.groupId, r.survivorId, r.oldPhaseId],
      );
      todosTouched += res.rowCount ?? 0;
    }
    for (const p of plan.progress) {
      await client.query(
        `INSERT INTO group_phase_progress (id, group_id, phase_id, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (group_id, phase_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
        [createId(), p.groupId, p.phaseId, p.status],
      );
      progressRows++;
    }
    deleteIds.push(...plan.deletePhaseIds);
  }
  console.log(`todos re-pointed: ${todosTouched}, progress rows written: ${progressRows}, phases to delete: ${deleteIds.length}`);
  assert(todosTouched === before.todos, `every to-do must be touched exactly once (${todosTouched} vs ${before.todos})`);

  if (deleteIds.length > 0) {
    await client.query(`DELETE FROM phases WHERE id = ANY($1::text[])`, [deleteIds]);
  }
  assert((await count(client, 'todos')) === before.todos, 'phase delete must not cascade to any to-do');

  // 5. NOT NULL + foreign keys.
  const nullTodos = await client.query(`SELECT count(*)::int AS n FROM todos WHERE group_id IS NULL`);
  assert(nullTodos.rows[0].n === 0, `${nullTodos.rows[0].n} to-dos still have group_id NULL`);
  const nullPhases = await client.query(`SELECT count(*)::int AS n FROM phases WHERE classroom_id IS NULL`);
  assert(nullPhases.rows[0].n === 0, `${nullPhases.rows[0].n} phases still have classroom_id NULL`);

  await client.query(`ALTER TABLE phases ALTER COLUMN classroom_id SET NOT NULL`);
  await client.query(`ALTER TABLE todos ALTER COLUMN group_id SET NOT NULL`);
  if (!(await constraintExists(client, 'phases_classroom_id_classrooms_id_fk'))) {
    await client.query(
      `ALTER TABLE phases ADD CONSTRAINT phases_classroom_id_classrooms_id_fk
         FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE cascade ON UPDATE no action`,
    );
  }
  if (!(await constraintExists(client, 'todos_group_id_groups_id_fk'))) {
    await client.query(
      `ALTER TABLE todos ADD CONSTRAINT todos_group_id_groups_id_fk
         FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE cascade ON UPDATE no action`,
    );
  }

  // 6. Drop the old columns (drops phases_group_id_groups_id_fk with it).
  await client.query(`ALTER TABLE phases DROP COLUMN group_id, DROP COLUMN status`);

  // 7. AFTER summary + invariants.
  const after = await counts(client);
  printCounts('AFTER', after);
  await printAfter(client);
  assert(after.todos === before.todos, 'to-do count changed');
  assert(after.submissions === before.submissions, 'submission count changed');
  assert(after.phases === before.phases - deleteIds.length, 'phase count mismatch');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  if (dryRun === apply) {
    console.error(USAGE);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL_UNPOOLED / DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  let ok = false;
  try {
    console.log(`MODE: ${dryRun ? 'DRY RUN (will roll back)' : 'APPLY (will commit)'}`);
    await client.query('BEGIN');
    // Never hang the live site behind our ALTER TABLE locks.
    await client.query(`SET LOCAL lock_timeout = '5s'`);
    await client.query(`SET LOCAL statement_timeout = '60s'`);
    await migrate(client);
    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('DRY RUN — rolled back');
    } else {
      await client.query('COMMIT');
      console.log('APPLIED — committed');
    }
    ok = true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('FAILED — rolled back:', err instanceof Error ? err.message : err);
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(ok ? 0 : 1);
}

void main();
