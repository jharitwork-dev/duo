/**
 * Schema migration 2026-10-21 (quick task 261021-r1c): classroom forms + "form as phase task".
 *
 *   forms           new table (id, classroom_id FK classrooms(id) ON DELETE CASCADE, title, description,
 *                   response_mode text default 'individual', status text default 'draft', closes_at,
 *                   created_by, created_at, updated_at)
 *     forms_classroom_id_idx                    btree (classroom_id)
 *   form_groups     new table (audience; empty = whole classroom)
 *     form_groups_form_id_group_id_unique       UNIQUE (form_id, group_id)
 *   form_questions  new table (order_index, type, title, description, required, config jsonb)
 *     form_questions_form_id_idx                btree (form_id)
 *   form_responses  new table (owner_key, user_id, group_id FK groups ON DELETE SET NULL, answers jsonb, …)
 *     form_responses_form_id_owner_key_unique   UNIQUE (form_id, owner_key)
 *   todos.form_id            text NULL FK forms(id) ON DELETE SET NULL  + todos_form_id_idx
 *   classroom_tasks.form_id  text NULL FK forms(id) ON DELETE SET NULL  + classroom_tasks_form_id_idx
 *
 * Additive only (ADD COLUMN / CREATE TABLE / CREATE INDEX ... IF NOT EXISTS); no rows are changed or
 * removed. Constraint/index names match what Drizzle generates so a later drizzle diff reports no changes.
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-10-21-forms.ts --dry-run   # runs everything, then ROLLBACK
 *   npx tsx src/db/migrations/2026-10-21-forms.ts --apply     # runs everything, then COMMIT
 *
 * WARNING: DATABASE_URL is shared with the LIVE site. Only the orchestrator runs --apply, after
 * reviewing the --dry-run output. Apply BEFORE deploying the matching code: the new code selects
 * todos.form_id / classroom_tasks.form_id and the forms tables (queries fail on the old schema), while
 * the old code ignores them. Do NOT use drizzle-kit push (see STATE.md).
 *
 * Idempotent: if all four tables, both form_id columns, both unique constraints, both form_id FKs and
 * all indexes already exist it prints "already migrated" and exits 0. Everything runs in ONE
 * transaction; any failed assertion throws and rolls back.
 */

import { config } from 'dotenv';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

neonConfig.webSocketConstructor = ws;

const USAGE = 'Usage: npx tsx src/db/migrations/2026-10-21-forms.ts (--dry-run | --apply)';

const NEW_TABLES = ['forms', 'form_groups', 'form_questions', 'form_responses'] as const;
const ALL_TABLES = [...NEW_TABLES, 'todos', 'classroom_tasks'];

const FORMS_CLASSROOM_FK = 'forms_classroom_id_classrooms_id_fk';
const FORMS_CLASSROOM_IDX = 'forms_classroom_id_idx';
const FG_FORM_FK = 'form_groups_form_id_forms_id_fk';
const FG_GROUP_FK = 'form_groups_group_id_groups_id_fk';
const FG_UNIQUE = 'form_groups_form_id_group_id_unique';
const FQ_FORM_FK = 'form_questions_form_id_forms_id_fk';
const FQ_FORM_IDX = 'form_questions_form_id_idx';
const FR_FORM_FK = 'form_responses_form_id_forms_id_fk';
const FR_GROUP_FK = 'form_responses_group_id_groups_id_fk';
const FR_UNIQUE = 'form_responses_form_id_owner_key_unique';
const TODOS_FORM_FK = 'todos_form_id_forms_id_fk';
const TODOS_FORM_IDX = 'todos_form_id_idx';
const CT_FORM_FK = 'classroom_tasks_form_id_forms_id_fk';
const CT_FORM_IDX = 'classroom_tasks_form_id_idx';

type Counts = { classrooms: number; groups: number; todos: number; classroomTasks: number; submissions: number };

async function count(client: PoolClient, table: string): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  return res.rows[0].n as number;
}

async function counts(client: PoolClient): Promise<Counts> {
  return {
    classrooms: await count(client, 'classrooms'),
    groups: await count(client, 'groups'),
    todos: await count(client, 'todos'),
    classroomTasks: await count(client, 'classroom_tasks'),
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
        AND (table_name = ANY($1::text[]) OR (table_name IN ('todos', 'classroom_tasks') AND column_name = 'form_id'))
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
      WHERE schemaname = current_schema()
        AND (tablename = ANY($1::text[]) OR indexname IN ($2, $3))
      ORDER BY tablename, indexname`,
    [[...NEW_TABLES], TODOS_FORM_IDX, CT_FORM_IDX],
  );
  console.log(`${label} indexes:`);
  if (idx.rows.length === 0) console.log('  (none)');
  for (const r of idx.rows) console.log(`  ${r.indexname}: ${r.indexdef}`);
  const cons = await client.query(
    `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE contype IN ('f', 'u')
        AND (conrelid::regclass::text = ANY($1::text[]) OR conname IN ($2, $3))
      ORDER BY 1, 2`,
    [[...NEW_TABLES], TODOS_FORM_FK, CT_FORM_FK],
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
    `${label}: classrooms=${c.classrooms} groups=${c.groups} todos=${c.todos} ` +
      `classroom_tasks=${c.classroomTasks} submissions=${c.submissions}`,
  );
}

async function isMigrated(client: PoolClient): Promise<boolean> {
  const checks = await Promise.all([
    ...NEW_TABLES.map((t) => tableExists(client, t)),
    columnExists(client, 'todos', 'form_id'),
    columnExists(client, 'classroom_tasks', 'form_id'),
    constraintExists(client, FG_UNIQUE),
    constraintExists(client, FR_UNIQUE),
    constraintExists(client, TODOS_FORM_FK),
    constraintExists(client, CT_FORM_FK),
    indexExists(client, FORMS_CLASSROOM_IDX),
    indexExists(client, FQ_FORM_IDX),
    indexExists(client, TODOS_FORM_IDX),
    indexExists(client, CT_FORM_IDX),
  ]);
  return checks.every(Boolean);
}

async function migrate(client: PoolClient) {
  if (await isMigrated(client)) {
    console.log(
      'already migrated (forms, form_groups, form_questions, form_responses, todos.form_id, ' +
        'classroom_tasks.form_id + constraints/indexes exist) — nothing to do',
    );
    printCounts('CURRENT', await counts(client));
    return;
  }

  const before = await counts(client);
  printCounts('BEFORE', before);
  await printSchema('BEFORE', client);

  await client.query(`
    CREATE TABLE IF NOT EXISTS forms (
      id text PRIMARY KEY NOT NULL,
      classroom_id text NOT NULL,
      title text NOT NULL,
      description text,
      response_mode text NOT NULL DEFAULT 'individual',
      status text NOT NULL DEFAULT 'draft',
      closes_at timestamp,
      created_by text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT ${FORMS_CLASSROOM_FK} FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS ${FORMS_CLASSROOM_IDX} ON forms USING btree (classroom_id)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS form_groups (
      id text PRIMARY KEY NOT NULL,
      form_id text NOT NULL,
      group_id text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT ${FG_FORM_FK} FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
      CONSTRAINT ${FG_GROUP_FK} FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      CONSTRAINT ${FG_UNIQUE} UNIQUE (form_id, group_id)
    )`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS form_questions (
      id text PRIMARY KEY NOT NULL,
      form_id text NOT NULL,
      order_index integer NOT NULL DEFAULT 0,
      type text NOT NULL,
      title text NOT NULL,
      description text,
      required boolean NOT NULL DEFAULT false,
      config jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT ${FQ_FORM_FK} FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS ${FQ_FORM_IDX} ON form_questions USING btree (form_id)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS form_responses (
      id text PRIMARY KEY NOT NULL,
      form_id text NOT NULL,
      owner_key text NOT NULL,
      user_id text NOT NULL,
      group_id text,
      answers jsonb NOT NULL DEFAULT '{}'::jsonb,
      submitted_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT ${FR_FORM_FK} FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
      CONSTRAINT ${FR_GROUP_FK} FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
      CONSTRAINT ${FR_UNIQUE} UNIQUE (form_id, owner_key)
    )`);

  await client.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS form_id text`);
  if (!(await constraintExists(client, TODOS_FORM_FK))) {
    await client.query(
      `ALTER TABLE todos ADD CONSTRAINT ${TODOS_FORM_FK} FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE SET NULL`,
    );
  }
  await client.query(`CREATE INDEX IF NOT EXISTS ${TODOS_FORM_IDX} ON todos USING btree (form_id)`);

  await client.query(`ALTER TABLE classroom_tasks ADD COLUMN IF NOT EXISTS form_id text`);
  if (!(await constraintExists(client, CT_FORM_FK))) {
    await client.query(
      `ALTER TABLE classroom_tasks ADD CONSTRAINT ${CT_FORM_FK} FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE SET NULL`,
    );
  }
  await client.query(`CREATE INDEX IF NOT EXISTS ${CT_FORM_IDX} ON classroom_tasks USING btree (form_id)`);

  const after = await counts(client);
  printCounts('AFTER', after);
  await printSchema('AFTER', client);

  assert(await isMigrated(client), 'forms tables / form_id columns / constraints / indexes missing');
  for (const name of [FORMS_CLASSROOM_FK, FG_FORM_FK, FG_GROUP_FK, FQ_FORM_FK, FR_FORM_FK, FR_GROUP_FK]) {
    assert(await constraintExists(client, name), `${name} missing`);
  }
  assert(after.classrooms === before.classrooms, 'classrooms count changed');
  assert(after.groups === before.groups, 'groups count changed');
  assert(after.todos === before.todos, 'todos count changed');
  assert(after.classroomTasks === before.classroomTasks, 'classroom_tasks count changed');
  assert(after.submissions === before.submissions, 'submissions count changed');

  for (const table of NEW_TABLES) {
    const n = await count(client, table);
    console.log(`AFTER ${table}=${n} (expected 0)`);
    assert(n === 0, `${table} should start empty`);
  }

  for (const table of ['todos', 'classroom_tasks']) {
    const linked = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE form_id IS NOT NULL`);
    console.log(`AFTER ${table} with form_id set=${linked.rows[0].n} (expected 0)`);
    assert(linked.rows[0].n === 0, `${table}.form_id should start NULL everywhere`);
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
