/**
 * Schema migration 2026-10-04 (quick task 261004-j6h): classroom-level tasks ("งานของห้องเรียน").
 *
 *   classroom_tasks         new table (one row per classroom task, FK phases ON DELETE CASCADE)
 *   classroom_task_files    new table (teacher files of a classroom task, FK classroom_tasks ON DELETE CASCADE)
 *   todos.classroom_task_id text NULL, FK classroom_tasks ON DELETE SET NULL
 *   todos.overridden_fields text[] NOT NULL DEFAULT '{}'
 *   todos_classroom_task_group_unique  partial unique index (classroom_task_id, group_id) WHERE classroom_task_id IS NOT NULL
 *
 * Additive only (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS); no rows are changed or removed.
 * No backfill: existing todos stay ordinary group tasks.
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-10-04-classroom-tasks.ts --dry-run   # runs everything, then ROLLBACK
 *   npx tsx src/db/migrations/2026-10-04-classroom-tasks.ts --apply     # runs everything, then COMMIT
 *
 * WARNING: DATABASE_URL is shared with the LIVE site. Run --apply only after reviewing the --dry-run
 * output, right before deploying the matching code (new code selects the new columns; old code ignores
 * them). NEVER use `drizzle-kit push` on this database (see STATE.md — it misreads constraints here).
 *
 * Idempotent: if both tables and both todos columns already exist it prints "already migrated" and exits 0.
 * Everything runs in ONE transaction; any failed assertion throws and rolls back.
 */

import { config } from 'dotenv';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

neonConfig.webSocketConstructor = ws;

const USAGE = 'Usage: npx tsx src/db/migrations/2026-10-04-classroom-tasks.ts (--dry-run | --apply)';

type Counts = { phases: number; groups: number; todos: number; todoAttachments: number; submissions: number };

async function count(client: PoolClient, table: string): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  return res.rows[0].n as number;
}

async function counts(client: PoolClient): Promise<Counts> {
  return {
    phases: await count(client, 'phases'),
    groups: await count(client, 'groups'),
    todos: await count(client, 'todos'),
    todoAttachments: await count(client, 'todo_attachments'),
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

async function tableExists(client: PoolClient, table: string): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1`,
    [table],
  );
  return (res.rowCount ?? 0) > 0;
}

async function indexExists(client: PoolClient, name: string): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = $1`,
    [name],
  );
  return (res.rowCount ?? 0) > 0;
}

async function constraintExists(client: PoolClient, name: string): Promise<boolean> {
  const res = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [name]);
  return (res.rowCount ?? 0) > 0;
}

async function printSchema(label: string, client: PoolClient) {
  const cols = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (table_name IN ('classroom_tasks', 'classroom_task_files')
             OR (table_name = 'todos' AND column_name IN ('classroom_task_id', 'overridden_fields')))
      ORDER BY table_name, ordinal_position`,
  );
  console.log(`${label} columns (table.column type nullable default):`);
  if (cols.rows.length === 0) console.log('  (none)');
  for (const r of cols.rows) {
    console.log(
      `  ${r.table_name}.${r.column_name} ${r.data_type} ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}` +
        `${r.column_default ? ` default ${r.column_default}` : ''}`,
    );
  }
  const idx = await client.query(
    `SELECT tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname = current_schema()
        AND (tablename IN ('classroom_tasks', 'classroom_task_files') OR indexname = 'todos_classroom_task_group_unique')
      ORDER BY tablename, indexname`,
  );
  console.log(`${label} indexes:`);
  if (idx.rows.length === 0) console.log('  (none)');
  for (const r of idx.rows) console.log(`  ${r.indexname}: ${r.indexdef}`);
  const fks = await client.query(
    `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE contype = 'f'
        AND (conrelid::regclass::text IN ('classroom_tasks', 'classroom_task_files')
             OR conname = 'todos_classroom_task_id_classroom_tasks_id_fk')
      ORDER BY 1, 2`,
  );
  console.log(`${label} foreign keys:`);
  if (fks.rows.length === 0) console.log('  (none)');
  for (const r of fks.rows) console.log(`  ${r.tbl}.${r.conname}: ${r.def}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function printCounts(label: string, c: Counts) {
  console.log(
    `${label}: phases=${c.phases} groups=${c.groups} todos=${c.todos} ` +
      `todo_attachments=${c.todoAttachments} submissions=${c.submissions}`,
  );
}

async function isMigrated(client: PoolClient): Promise<boolean> {
  const checks = await Promise.all([
    tableExists(client, 'classroom_tasks'),
    tableExists(client, 'classroom_task_files'),
    columnExists(client, 'todos', 'classroom_task_id'),
    columnExists(client, 'todos', 'overridden_fields'),
  ]);
  return checks.every(Boolean);
}

async function migrate(client: PoolClient) {
  if (await isMigrated(client)) {
    console.log('already migrated (classroom_tasks, classroom_task_files, todos.classroom_task_id, todos.overridden_fields exist) — nothing to do');
    printCounts('CURRENT', await counts(client));
    return;
  }

  const before = await counts(client);
  printCounts('BEFORE', before);
  await printSchema('BEFORE', client);

  await client.query(`
    CREATE TABLE IF NOT EXISTS classroom_tasks (
      id text PRIMARY KEY,
      phase_id text NOT NULL,
      title text NOT NULL,
      description text,
      notes text,
      submission_mode text NOT NULL DEFAULT 'group',
      file_requirement text NOT NULL DEFAULT 'optional',
      deadline timestamp,
      order_index integer NOT NULL DEFAULT 0,
      created_by text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT classroom_tasks_phase_id_phases_id_fk FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE
    )`);
  await client.query(
    `CREATE INDEX IF NOT EXISTS classroom_tasks_phase_id_idx ON classroom_tasks USING btree (phase_id)`,
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS classroom_task_files (
      id text PRIMARY KEY,
      classroom_task_id text NOT NULL,
      file_name text NOT NULL,
      file_key text NOT NULL,
      content_type text NOT NULL,
      file_size integer NOT NULL,
      uploaded_by text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT classroom_task_files_classroom_task_id_classroom_tasks_id_fk
        FOREIGN KEY (classroom_task_id) REFERENCES classroom_tasks(id) ON DELETE CASCADE
    )`);
  await client.query(
    `CREATE INDEX IF NOT EXISTS classroom_task_files_task_id_idx ON classroom_task_files USING btree (classroom_task_id)`,
  );

  await client.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS classroom_task_id text`);
  await client.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS overridden_fields text[] NOT NULL DEFAULT '{}'`);
  if (!(await constraintExists(client, 'todos_classroom_task_id_classroom_tasks_id_fk'))) {
    await client.query(
      `ALTER TABLE todos ADD CONSTRAINT todos_classroom_task_id_classroom_tasks_id_fk
         FOREIGN KEY (classroom_task_id) REFERENCES classroom_tasks(id) ON DELETE SET NULL`,
    );
  }
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS todos_classroom_task_group_unique
       ON todos USING btree (classroom_task_id, group_id) WHERE classroom_task_id IS NOT NULL`,
  );

  const after = await counts(client);
  printCounts('AFTER', after);
  await printSchema('AFTER', client);

  assert(await tableExists(client, 'classroom_tasks'), 'classroom_tasks missing');
  assert(await tableExists(client, 'classroom_task_files'), 'classroom_task_files missing');
  assert(await columnExists(client, 'todos', 'classroom_task_id'), 'todos.classroom_task_id missing');
  assert(await columnExists(client, 'todos', 'overridden_fields'), 'todos.overridden_fields missing');
  assert(await indexExists(client, 'todos_classroom_task_group_unique'), 'todos_classroom_task_group_unique missing');
  assert(await indexExists(client, 'classroom_tasks_phase_id_idx'), 'classroom_tasks_phase_id_idx missing');
  assert(await indexExists(client, 'classroom_task_files_task_id_idx'), 'classroom_task_files_task_id_idx missing');
  assert(
    await constraintExists(client, 'todos_classroom_task_id_classroom_tasks_id_fk'),
    'todos classroom_task_id FK missing',
  );
  assert(after.phases === before.phases, 'phase count changed');
  assert(after.groups === before.groups, 'group count changed');
  assert(after.todos === before.todos, 'todo count changed');
  assert(after.todoAttachments === before.todoAttachments, 'todo_attachments count changed');
  assert(after.submissions === before.submissions, 'submission count changed');

  const linked = await client.query(`SELECT count(*)::int AS n FROM todos WHERE classroom_task_id IS NOT NULL`);
  const overridden = await client.query(`SELECT count(*)::int AS n FROM todos WHERE overridden_fields <> '{}'`);
  const tasks = await count(client, 'classroom_tasks');
  const files = await count(client, 'classroom_task_files');
  console.log(
    `AFTER todos linked=${linked.rows[0].n} overridden=${overridden.rows[0].n} ` +
      `classroom_tasks=${tasks} classroom_task_files=${files} (all expected 0)`,
  );
  assert(linked.rows[0].n === 0, 'no todo should be linked yet');
  assert(overridden.rows[0].n === 0, 'no todo should have overrides yet');
  assert(tasks === 0, 'classroom_tasks should start empty');
  assert(files === 0, 'classroom_task_files should start empty');
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
