/**
 * Schema migration 2026-10-04 (quick task 261004-01i): Notion-like work pages.
 *
 *   todos.file_requirement   text NOT NULL DEFAULT 'optional'   ('none' | 'optional' | 'required')
 *   submissions.content      jsonb NULL                         (work page snapshot; legacy rows stay NULL)
 *   work_pages               new table (one page per (todo, group) for group to-dos, per (todo, user) for individual)
 *     work_pages_todo_group_unique  UNIQUE (todo_id, group_id) WHERE user_id IS NULL
 *     work_pages_todo_user_unique   UNIQUE (todo_id, user_id)  WHERE user_id IS NOT NULL
 *   work_page_files          new table (+ work_page_files_work_page_id_idx)
 *
 * Additive only (ADD COLUMN / CREATE TABLE / CREATE INDEX ... IF NOT EXISTS); no rows are changed or removed.
 * Constraint/index names match what Drizzle generates so a later `drizzle-kit push` reports no changes.
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-10-04-work-pages.ts --dry-run   # runs everything, then ROLLBACK
 *   npx tsx src/db/migrations/2026-10-04-work-pages.ts --apply     # runs everything, then COMMIT
 *
 * WARNING: DATABASE_URL is shared with the LIVE site. Only the orchestrator runs --apply, after
 * reviewing the --dry-run output. Apply BEFORE deploying the matching code: the new code selects
 * todos.file_requirement / submissions.content and the work_pages tables (queries fail on the old
 * schema), while the old code ignores them. Do NOT use drizzle-kit push (see STATE.md).
 *
 * Idempotent: if both columns, both tables and both unique indexes exist it prints "already migrated"
 * and exits 0. Everything runs in ONE transaction; any failed assertion throws and rolls back.
 */

import { config } from 'dotenv';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

neonConfig.webSocketConstructor = ws;

const USAGE = 'Usage: npx tsx src/db/migrations/2026-10-04-work-pages.ts (--dry-run | --apply)';

const UNIQUE_INDEXES = ['work_pages_todo_group_unique', 'work_pages_todo_user_unique'] as const;

type Counts = { todos: number; submissions: number; submissionFiles: number };

async function count(client: PoolClient, table: string): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  return res.rows[0].n as number;
}

async function counts(client: PoolClient): Promise<Counts> {
  return {
    todos: await count(client, 'todos'),
    submissions: await count(client, 'submissions'),
    submissionFiles: await count(client, 'submission_files'),
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

async function printSchema(label: string, client: PoolClient) {
  const cols = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (table_name IN ('work_pages', 'work_page_files')
             OR (table_name = 'todos' AND column_name = 'file_requirement')
             OR (table_name = 'submissions' AND column_name = 'content'))
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
      WHERE schemaname = current_schema() AND tablename IN ('work_pages', 'work_page_files')
      ORDER BY tablename, indexname`,
  );
  console.log(`${label} indexes:`);
  if (idx.rows.length === 0) console.log('  (none)');
  for (const r of idx.rows) console.log(`  ${r.indexname}: ${r.indexdef}`);
  const fks = await client.query(
    `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE contype = 'f' AND conrelid::regclass::text IN ('work_pages', 'work_page_files')
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
  console.log(`${label}: todos=${c.todos} submissions=${c.submissions} submission_files=${c.submissionFiles}`);
}

async function isMigrated(client: PoolClient): Promise<boolean> {
  const checks = await Promise.all([
    columnExists(client, 'todos', 'file_requirement'),
    columnExists(client, 'submissions', 'content'),
    tableExists(client, 'work_pages'),
    tableExists(client, 'work_page_files'),
    ...UNIQUE_INDEXES.map((name) => indexExists(client, name)),
  ]);
  return checks.every(Boolean);
}

async function migrate(client: PoolClient) {
  if (await isMigrated(client)) {
    console.log('already migrated (file_requirement, submissions.content, work_pages, work_page_files exist) — nothing to do');
    printCounts('CURRENT', await counts(client));
    return;
  }

  const before = await counts(client);
  printCounts('BEFORE', before);
  await printSchema('BEFORE', client);

  await client.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS file_requirement text NOT NULL DEFAULT 'optional'`);
  await client.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS content jsonb`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS work_pages (
      id text PRIMARY KEY NOT NULL,
      todo_id text NOT NULL,
      group_id text,
      user_id text,
      content jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      updated_by text,
      CONSTRAINT work_pages_todo_id_todos_id_fk FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
      CONSTRAINT work_pages_group_id_groups_id_fk FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    )`);
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS work_pages_todo_group_unique ON work_pages USING btree (todo_id, group_id) WHERE user_id IS NULL`,
  );
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS work_pages_todo_user_unique ON work_pages USING btree (todo_id, user_id) WHERE user_id IS NOT NULL`,
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS work_page_files (
      id text PRIMARY KEY NOT NULL,
      work_page_id text NOT NULL,
      file_name text NOT NULL,
      file_key text NOT NULL,
      content_type text NOT NULL,
      file_size integer NOT NULL,
      uploaded_by text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT work_page_files_work_page_id_work_pages_id_fk FOREIGN KEY (work_page_id) REFERENCES work_pages(id) ON DELETE CASCADE
    )`);
  await client.query(
    `CREATE INDEX IF NOT EXISTS work_page_files_work_page_id_idx ON work_page_files USING btree (work_page_id)`,
  );

  const after = await counts(client);
  printCounts('AFTER', after);
  await printSchema('AFTER', client);

  assert(await isMigrated(client), 'columns / tables / unique indexes missing after migration');
  assert(await indexExists(client, 'work_page_files_work_page_id_idx'), 'work_page_files_work_page_id_idx missing');
  assert(after.todos === before.todos, 'todo count changed');
  assert(after.submissions === before.submissions, 'submission count changed');
  assert(after.submissionFiles === before.submissionFiles, 'submission_files count changed');

  const reqs = await client.query(
    `SELECT file_requirement, count(*)::int AS n FROM todos GROUP BY file_requirement ORDER BY file_requirement`,
  );
  console.log('AFTER todos.file_requirement distribution:');
  if (reqs.rows.length === 0) console.log('  (no todos)');
  for (const r of reqs.rows) console.log(`  ${r.file_requirement}: ${r.n}`);
  const nonOptional = await client.query(`SELECT count(*)::int AS n FROM todos WHERE file_requirement <> 'optional'`);
  assert(nonOptional.rows[0].n === 0, "every existing todo should start with file_requirement = 'optional'");

  const withContent = await client.query(`SELECT count(*)::int AS n FROM submissions WHERE content IS NOT NULL`);
  console.log(`AFTER submissions with content: ${withContent.rows[0].n} (expected 0)`);
  assert(withContent.rows[0].n === 0, 'submissions.content should start NULL everywhere');

  const pages = await count(client, 'work_pages');
  const pageFiles = await count(client, 'work_page_files');
  console.log(`AFTER work_pages=${pages} work_page_files=${pageFiles} (expected 0 / 0)`);
  assert(pages === 0 && pageFiles === 0, 'new tables should start empty');
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
