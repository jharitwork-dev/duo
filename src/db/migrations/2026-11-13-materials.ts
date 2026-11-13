/**
 * Schema migration 2026-11-13 (quick task 261113-lz7): learning materials ("สื่อการเรียน").
 *
 *   materials       new table (id, classroom_id FK classrooms(id) ON DELETE CASCADE,
 *                   phase_id NULL FK phases(id) ON DELETE CASCADE, title, description, link_url,
 *                   order_index integer default 0, created_by, created_at, updated_at)
 *     materials_classroom_id_idx                btree (classroom_id)
 *     materials_phase_id_idx                    btree (phase_id)
 *   material_files  new table (id, material_id FK materials(id) ON DELETE CASCADE, file_name, file_key,
 *                   content_type, file_size, uploaded_by, created_at)
 *     material_files_material_id_idx            btree (material_id)
 *
 * Additive only (CREATE TABLE / CREATE INDEX ... IF NOT EXISTS, FKs added only when missing); no
 * existing rows are changed or removed. Constraint/index names match what Drizzle generates so a later
 * drizzle diff reports no changes.
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-11-13-materials.ts --dry-run   # runs everything, then ROLLBACK
 *   npx tsx src/db/migrations/2026-11-13-materials.ts --apply     # runs everything, then COMMIT
 *
 * WARNING: DATABASE_URL is shared with the LIVE site. Only the orchestrator runs --apply, after
 * reviewing the --dry-run output. Apply BEFORE deploying the matching code: the new code selects the
 * materials tables (queries fail on the old schema), while the old code ignores them. Do NOT use
 * drizzle-kit push (see STATE.md).
 *
 * Idempotent: if both tables, all three FKs and all three indexes already exist it prints
 * "already migrated" and exits 0. Everything runs in ONE transaction; any failed assertion throws and
 * rolls back.
 */

import { config } from 'dotenv';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

neonConfig.webSocketConstructor = ws;

const USAGE = 'Usage: npx tsx src/db/migrations/2026-11-13-materials.ts (--dry-run | --apply)';

const NEW_TABLES = ['materials', 'material_files'] as const;
const ALL_TABLES = [...NEW_TABLES, 'classrooms', 'phases'];

const MAT_CLASSROOM_FK = 'materials_classroom_id_classrooms_id_fk';
const MAT_PHASE_FK = 'materials_phase_id_phases_id_fk';
const MAT_CLASSROOM_IDX = 'materials_classroom_id_idx';
const MAT_PHASE_IDX = 'materials_phase_id_idx';
const MF_MATERIAL_FK = 'material_files_material_id_materials_id_fk';
const MF_MATERIAL_IDX = 'material_files_material_id_idx';

const FKS = [MAT_CLASSROOM_FK, MAT_PHASE_FK, MF_MATERIAL_FK];
const INDEXES = [MAT_CLASSROOM_IDX, MAT_PHASE_IDX, MF_MATERIAL_IDX];

type Counts = { classrooms: number; phases: number; groups: number; todos: number; submissions: number };

async function count(client: PoolClient, table: string): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  return res.rows[0].n as number;
}

async function counts(client: PoolClient): Promise<Counts> {
  return {
    classrooms: await count(client, 'classrooms'),
    phases: await count(client, 'phases'),
    groups: await count(client, 'groups'),
    todos: await count(client, 'todos'),
    submissions: await count(client, 'submissions'),
  };
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
      WHERE table_schema = current_schema() AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position`,
    [[...NEW_TABLES]],
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
      WHERE schemaname = current_schema() AND tablename = ANY($1::text[])
      ORDER BY tablename, indexname`,
    [[...NEW_TABLES]],
  );
  console.log(`${label} indexes:`);
  if (idx.rows.length === 0) console.log('  (none)');
  for (const r of idx.rows) console.log(`  ${r.indexname}: ${r.indexdef}`);
  const cons = await client.query(
    `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE contype IN ('f', 'u') AND conrelid::regclass::text = ANY($1::text[])
      ORDER BY 1, 2`,
    [[...NEW_TABLES]],
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
    `${label}: classrooms=${c.classrooms} phases=${c.phases} groups=${c.groups} todos=${c.todos} ` +
      `submissions=${c.submissions}`,
  );
}

async function isMigrated(client: PoolClient): Promise<boolean> {
  const checks = await Promise.all([
    ...NEW_TABLES.map((t) => tableExists(client, t)),
    ...FKS.map((name) => constraintExists(client, name)),
    ...INDEXES.map((name) => indexExists(client, name)),
  ]);
  return checks.every(Boolean);
}

async function migrate(client: PoolClient) {
  if (await isMigrated(client)) {
    console.log('already migrated (materials, material_files + constraints/indexes exist) — nothing to do');
    printCounts('CURRENT', await counts(client));
    return;
  }

  const before = await counts(client);
  printCounts('BEFORE', before);
  await printSchema('BEFORE', client);

  await client.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id text PRIMARY KEY NOT NULL,
      classroom_id text NOT NULL,
      phase_id text,
      title text NOT NULL,
      description text,
      link_url text,
      order_index integer NOT NULL DEFAULT 0,
      created_by text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
  if (!(await constraintExists(client, MAT_CLASSROOM_FK))) {
    await client.query(
      `ALTER TABLE materials ADD CONSTRAINT ${MAT_CLASSROOM_FK} FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE`,
    );
  }
  if (!(await constraintExists(client, MAT_PHASE_FK))) {
    await client.query(
      `ALTER TABLE materials ADD CONSTRAINT ${MAT_PHASE_FK} FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE`,
    );
  }
  await client.query(`CREATE INDEX IF NOT EXISTS ${MAT_CLASSROOM_IDX} ON materials USING btree (classroom_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS ${MAT_PHASE_IDX} ON materials USING btree (phase_id)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS material_files (
      id text PRIMARY KEY NOT NULL,
      material_id text NOT NULL,
      file_name text NOT NULL,
      file_key text NOT NULL,
      content_type text NOT NULL,
      file_size integer NOT NULL,
      uploaded_by text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`);
  if (!(await constraintExists(client, MF_MATERIAL_FK))) {
    await client.query(
      `ALTER TABLE material_files ADD CONSTRAINT ${MF_MATERIAL_FK} FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE`,
    );
  }
  await client.query(`CREATE INDEX IF NOT EXISTS ${MF_MATERIAL_IDX} ON material_files USING btree (material_id)`);

  const after = await counts(client);
  printCounts('AFTER', after);
  await printSchema('AFTER', client);

  assert(await isMigrated(client), 'materials tables / constraints / indexes missing');
  assert(after.classrooms === before.classrooms, 'classrooms count changed');
  assert(after.phases === before.phases, 'phases count changed');
  assert(after.groups === before.groups, 'groups count changed');
  assert(after.todos === before.todos, 'todos count changed');
  assert(after.submissions === before.submissions, 'submissions count changed');

  for (const table of NEW_TABLES) {
    const n = await count(client, table);
    console.log(`AFTER ${table}=${n} (expected 0)`);
    assert(n === 0, `${table} should start empty`);
  }
  console.log(`checked tables: ${ALL_TABLES.join(', ')}`);
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
