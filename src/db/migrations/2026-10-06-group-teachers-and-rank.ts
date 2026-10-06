/**
 * Schema migration 2026-10-06 (quick task 261006-ij6): group responsible teachers + classroom teacher rank.
 *
 *   classroom_members.teacher_rank  text NULL            ('teacher' | 'assistant'; null = ครู; display only)
 *   group_teachers                  new table (id, group_id FK groups(id) ON DELETE CASCADE, user_id, created_at)
 *     group_teachers_group_id_user_id_unique  UNIQUE (group_id, user_id)
 *     group_teachers_user_id_idx              btree (user_id)
 *
 * Additive only (ADD COLUMN / CREATE TABLE / CREATE INDEX ... IF NOT EXISTS); no rows are changed or
 * removed. Constraint/index names match what Drizzle generates so a later drizzle diff reports no changes.
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-10-06-group-teachers-and-rank.ts --dry-run   # runs everything, then ROLLBACK
 *   npx tsx src/db/migrations/2026-10-06-group-teachers-and-rank.ts --apply     # runs everything, then COMMIT
 *
 * WARNING: DATABASE_URL is shared with the LIVE site. Only the orchestrator runs --apply, after
 * reviewing the --dry-run output. Apply BEFORE deploying the matching code: the new code selects
 * classroom_members.teacher_rank and the group_teachers table (queries fail on the old schema), while the
 * old code ignores them. Do NOT use drizzle-kit push (see STATE.md).
 *
 * Idempotent: if teacher_rank, group_teachers, its unique constraint and its user_id index already exist
 * it prints "already migrated" and exits 0. Everything runs in ONE transaction; any failed assertion
 * throws and rolls back.
 */

import { config } from 'dotenv';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

neonConfig.webSocketConstructor = ws;

const USAGE = 'Usage: npx tsx src/db/migrations/2026-10-06-group-teachers-and-rank.ts (--dry-run | --apply)';

const GT_FK = 'group_teachers_group_id_groups_id_fk';
const GT_UNIQUE = 'group_teachers_group_id_user_id_unique';
const GT_USER_IDX = 'group_teachers_user_id_idx';

type Counts = { classroomMembers: number; groups: number; groupMembers: number };

async function count(client: PoolClient, table: string): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  return res.rows[0].n as number;
}

async function counts(client: PoolClient): Promise<Counts> {
  return {
    classroomMembers: await count(client, 'classroom_members'),
    groups: await count(client, 'groups'),
    groupMembers: await count(client, 'group_members'),
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
      WHERE table_schema = current_schema() AND table_name IN ('classroom_members', 'group_teachers')
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
      WHERE schemaname = current_schema() AND tablename IN ('classroom_members', 'group_teachers')
      ORDER BY tablename, indexname`,
  );
  console.log(`${label} indexes:`);
  if (idx.rows.length === 0) console.log('  (none)');
  for (const r of idx.rows) console.log(`  ${r.indexname}: ${r.indexdef}`);
  const cons = await client.query(
    `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE contype IN ('f', 'u') AND conrelid::regclass::text IN ('classroom_members', 'group_teachers')
      ORDER BY 1, 2`,
  );
  console.log(`${label} foreign keys / unique constraints:`);
  if (cons.rows.length === 0) console.log('  (none)');
  for (const r of cons.rows) console.log(`  ${r.tbl}.${r.conname}: ${r.def}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function printCounts(label: string, c: Counts) {
  console.log(
    `${label}: classroom_members=${c.classroomMembers} groups=${c.groups} group_members=${c.groupMembers}`,
  );
}

async function isMigrated(client: PoolClient): Promise<boolean> {
  const checks = await Promise.all([
    columnExists(client, 'classroom_members', 'teacher_rank'),
    tableExists(client, 'group_teachers'),
    constraintExists(client, GT_UNIQUE),
    indexExists(client, GT_USER_IDX),
  ]);
  return checks.every(Boolean);
}

async function migrate(client: PoolClient) {
  if (await isMigrated(client)) {
    console.log(
      'already migrated (classroom_members.teacher_rank, group_teachers + unique + user_id index exist) — nothing to do',
    );
    printCounts('CURRENT', await counts(client));
    return;
  }

  const before = await counts(client);
  printCounts('BEFORE', before);
  await printSchema('BEFORE', client);

  await client.query(`ALTER TABLE classroom_members ADD COLUMN IF NOT EXISTS teacher_rank text`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS group_teachers (
      id text PRIMARY KEY NOT NULL,
      group_id text NOT NULL,
      user_id text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT ${GT_FK} FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      CONSTRAINT ${GT_UNIQUE} UNIQUE (group_id, user_id)
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS ${GT_USER_IDX} ON group_teachers USING btree (user_id)`);

  const after = await counts(client);
  printCounts('AFTER', after);
  await printSchema('AFTER', client);

  assert(await isMigrated(client), 'teacher_rank / group_teachers / unique / user_id index missing');
  assert(await constraintExists(client, GT_FK), `${GT_FK} missing`);
  assert(await constraintExists(client, GT_UNIQUE), `${GT_UNIQUE} missing`);
  assert(after.classroomMembers === before.classroomMembers, 'classroom_members count changed');
  assert(after.groups === before.groups, 'groups count changed');
  assert(after.groupMembers === before.groupMembers, 'group_members count changed');

  const gt = await count(client, 'group_teachers');
  console.log(`AFTER group_teachers=${gt} (expected 0)`);
  assert(gt === 0, 'group_teachers should start empty');

  const ranked = await client.query(
    `SELECT count(*)::int AS n FROM classroom_members WHERE teacher_rank IS NOT NULL`,
  );
  console.log(`AFTER classroom_members with teacher_rank set=${ranked.rows[0].n} (expected 0)`);
  assert(ranked.rows[0].n === 0, 'teacher_rank should start NULL everywhere');
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
