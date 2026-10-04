/**
 * Schema migration 2026-10-04 (quick task 261004-fgj): task discussion threads.
 *
 *   comments.work_page_id   text NULL FK work_pages(id) ON DELETE CASCADE   (thread = work page)
 *   comments.author_role    text NOT NULL DEFAULT 'student'                 ('teacher' | 'student')
 *   comments.edited_at      timestamp NULL
 *   comments.deleted_at     timestamp NULL                                  (soft delete)
 *   comments.submission_id  DROP NOT NULL                                   ("written at round n" context)
 *   comments_work_page_created_idx  (work_page_id, created_at)
 *   comments_submission_id_idx      (submission_id)
 *   comment_reads           new table (user_id, work_page_id FK cascade, last_seen_at)
 *     comment_reads_user_page_unique  UNIQUE (user_id, work_page_id)
 *
 * Additive only (ADD COLUMN / DROP NOT NULL / CREATE TABLE / CREATE INDEX ... IF NOT EXISTS); no rows are
 * changed or removed. Constraint/index names match what Drizzle generates so a later `drizzle-kit push`
 * reports no changes. If `comments` does not exist at all it is created with the full new definition.
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-10-04-comment-threads.ts --dry-run   # runs everything, then ROLLBACK
 *   npx tsx src/db/migrations/2026-10-04-comment-threads.ts --apply     # runs everything, then COMMIT
 *
 * WARNING: DATABASE_URL is shared with the LIVE site. Only the orchestrator runs --apply, after
 * reviewing the --dry-run output. Apply BEFORE deploying the matching code: the new code selects
 * comments.work_page_id / author_role / edited_at / deleted_at and the comment_reads table (queries fail
 * on the old schema), while the old code ignores them. Do NOT use drizzle-kit push (see STATE.md).
 *
 * Idempotent: if every new column, comment_reads, its unique index and the nullable submission_id are
 * already in place it prints "already migrated" and exits 0. Everything runs in ONE transaction; any
 * failed assertion throws and rolls back.
 */

import { config } from 'dotenv';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

neonConfig.webSocketConstructor = ws;

const USAGE = 'Usage: npx tsx src/db/migrations/2026-10-04-comment-threads.ts (--dry-run | --apply)';

const NEW_COMMENT_COLUMNS = ['work_page_id', 'author_role', 'edited_at', 'deleted_at'] as const;
const WORK_PAGE_FK = 'comments_work_page_id_work_pages_id_fk';
const READS_FK = 'comment_reads_work_page_id_work_pages_id_fk';
const READS_UNIQUE = 'comment_reads_user_page_unique';
const INDEXES = ['comments_work_page_created_idx', 'comments_submission_id_idx'] as const;

type Counts = { comments: number; workPages: number; submissions: number };

async function count(client: PoolClient, table: string): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  return res.rows[0].n as number;
}

async function counts(client: PoolClient): Promise<Counts> {
  return {
    comments: await count(client, 'comments'),
    workPages: await count(client, 'work_pages'),
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

async function columnNullable(client: PoolClient, table: string, column: string): Promise<boolean> {
  const res = await client.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return res.rows[0]?.is_nullable === 'YES';
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
      WHERE table_schema = current_schema() AND table_name IN ('comments', 'comment_reads')
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
      WHERE schemaname = current_schema() AND tablename IN ('comments', 'comment_reads')
      ORDER BY tablename, indexname`,
  );
  console.log(`${label} indexes:`);
  if (idx.rows.length === 0) console.log('  (none)');
  for (const r of idx.rows) console.log(`  ${r.indexname}: ${r.indexdef}`);
  const fks = await client.query(
    `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE contype = 'f' AND conrelid::regclass::text IN ('comments', 'comment_reads')
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
  console.log(`${label}: comments=${c.comments} work_pages=${c.workPages} submissions=${c.submissions}`);
}

async function isMigrated(client: PoolClient): Promise<boolean> {
  if (!(await tableExists(client, 'comments'))) return false;
  const checks = await Promise.all([
    ...NEW_COMMENT_COLUMNS.map((c) => columnExists(client, 'comments', c)),
    columnNullable(client, 'comments', 'submission_id'),
    tableExists(client, 'comment_reads'),
    indexExists(client, READS_UNIQUE),
  ]);
  return checks.every(Boolean);
}

async function migrate(client: PoolClient) {
  if (await isMigrated(client)) {
    console.log(
      'already migrated (comments.work_page_id/author_role/edited_at/deleted_at, nullable submission_id, comment_reads exist) — nothing to do',
    );
    printCounts('CURRENT', await counts(client));
    return;
  }

  const commentsExisted = await tableExists(client, 'comments');
  console.log(`comments table exists: ${commentsExisted ? 'yes (evolve in place)' : 'no (create)'}`);

  if (!commentsExisted) {
    await client.query(`
      CREATE TABLE comments (
        id text PRIMARY KEY NOT NULL,
        submission_id text,
        work_page_id text,
        user_id text NOT NULL,
        author_role text NOT NULL DEFAULT 'student',
        content text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        edited_at timestamp,
        deleted_at timestamp,
        CONSTRAINT comments_submission_id_submissions_id_fk FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        CONSTRAINT ${WORK_PAGE_FK} FOREIGN KEY (work_page_id) REFERENCES work_pages(id) ON DELETE CASCADE
      )`);
  }

  const before = await counts(client);
  printCounts('BEFORE', before);
  await printSchema('BEFORE', client);

  if (commentsExisted) {
    await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS work_page_id text`);
    await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_role text NOT NULL DEFAULT 'student'`);
    await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at timestamp`);
    await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
    await client.query(`ALTER TABLE comments ALTER COLUMN submission_id DROP NOT NULL`);
    if (!(await constraintExists(client, WORK_PAGE_FK))) {
      await client.query(
        `ALTER TABLE comments ADD CONSTRAINT ${WORK_PAGE_FK} FOREIGN KEY (work_page_id) REFERENCES work_pages(id) ON DELETE CASCADE`,
      );
    }
  }
  await client.query(
    `CREATE INDEX IF NOT EXISTS comments_work_page_created_idx ON comments USING btree (work_page_id, created_at)`,
  );
  await client.query(`CREATE INDEX IF NOT EXISTS comments_submission_id_idx ON comments USING btree (submission_id)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS comment_reads (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      work_page_id text NOT NULL,
      last_seen_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT ${READS_FK} FOREIGN KEY (work_page_id) REFERENCES work_pages(id) ON DELETE CASCADE
    )`);
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${READS_UNIQUE} ON comment_reads USING btree (user_id, work_page_id)`,
  );

  const after = await counts(client);
  printCounts('AFTER', after);
  await printSchema('AFTER', client);

  assert(await isMigrated(client), 'columns / comment_reads / unique index / nullable submission_id missing');
  for (const name of INDEXES) assert(await indexExists(client, name), `${name} missing`);
  assert(await constraintExists(client, WORK_PAGE_FK), `${WORK_PAGE_FK} missing`);
  assert(await constraintExists(client, READS_FK), `${READS_FK} missing`);
  assert(after.comments === before.comments, 'comment count changed');
  assert(after.workPages === before.workPages, 'work_pages count changed');
  assert(after.submissions === before.submissions, 'submission count changed');

  const roles = await client.query(
    `SELECT author_role, count(*)::int AS n FROM comments GROUP BY author_role ORDER BY author_role`,
  );
  console.log('AFTER comments.author_role distribution:');
  if (roles.rows.length === 0) console.log('  (no comments)');
  for (const r of roles.rows) console.log(`  ${r.author_role}: ${r.n}`);

  const reads = await count(client, 'comment_reads');
  console.log(`AFTER comment_reads=${reads} (expected 0)`);
  assert(reads === 0, 'comment_reads should start empty');
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
