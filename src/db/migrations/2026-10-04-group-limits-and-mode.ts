/**
 * Schema migration 2026-10-04 (quick task 261004-02p): per-group member limit + classroom group mode.
 *
 *   groups.max_members     integer NULL                       (null = classroom default / unlimited)
 *   classrooms.group_mode  text NOT NULL DEFAULT 'teacher'    ('teacher' | 'self_join' | 'self_create')
 *
 * Additive only (ADD COLUMN IF NOT EXISTS); no rows are changed or removed.
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-10-04-group-limits-and-mode.ts --dry-run   # runs everything, then ROLLBACK
 *   npx tsx src/db/migrations/2026-10-04-group-limits-and-mode.ts --apply     # runs everything, then COMMIT
 *
 * WARNING: DATABASE_URL is shared with the LIVE site. Only the orchestrator runs --apply, after
 * reviewing the --dry-run output. Apply right before/after deploying the matching code: the new code
 * selects these columns (queries fail on the old schema), while the old code ignores them, so applying
 * slightly BEFORE the deploy is the safe order. After --apply, `npx drizzle-kit push` must report
 * no changes (do NOT confirm any prompt it shows — see STATE.md, push misreads constraints here).
 *
 * Idempotent: if both columns already exist it prints "already migrated" and exits 0.
 * Everything runs in ONE transaction; any failed assertion throws and rolls back.
 */

import { config } from 'dotenv';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

neonConfig.webSocketConstructor = ws;

const USAGE = 'Usage: npx tsx src/db/migrations/2026-10-04-group-limits-and-mode.ts (--dry-run | --apply)';

type Counts = { classrooms: number; groups: number; groupMembers: number };

async function count(client: PoolClient, table: string): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  return res.rows[0].n as number;
}

async function counts(client: PoolClient): Promise<Counts> {
  return {
    classrooms: await count(client, 'classrooms'),
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

async function printColumns(label: string, client: PoolClient) {
  const res = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name IN ('classrooms', 'groups')
      ORDER BY table_name, ordinal_position`,
  );
  console.log(`${label} columns (table.column type nullable default):`);
  for (const r of res.rows) {
    console.log(
      `  ${r.table_name}.${r.column_name} ${r.data_type} ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}` +
        `${r.column_default ? ` default ${r.column_default}` : ''}`,
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function printCounts(label: string, c: Counts) {
  console.log(`${label}: classrooms=${c.classrooms} groups=${c.groups} group_members=${c.groupMembers}`);
}

async function migrate(client: PoolClient) {
  const hasMaxMembers = await columnExists(client, 'groups', 'max_members');
  const hasGroupMode = await columnExists(client, 'classrooms', 'group_mode');
  if (hasMaxMembers && hasGroupMode) {
    console.log('already migrated (groups.max_members and classrooms.group_mode exist) — nothing to do');
    printCounts('CURRENT', await counts(client));
    return;
  }

  const before = await counts(client);
  printCounts('BEFORE', before);
  await printColumns('BEFORE', client);

  await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_members integer`);
  await client.query(`ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS group_mode text NOT NULL DEFAULT 'teacher'`);

  const after = await counts(client);
  printCounts('AFTER', after);
  await printColumns('AFTER', client);

  assert(await columnExists(client, 'groups', 'max_members'), 'groups.max_members missing after ALTER');
  assert(await columnExists(client, 'classrooms', 'group_mode'), 'classrooms.group_mode missing after ALTER');
  assert(after.classrooms === before.classrooms, 'classroom count changed');
  assert(after.groups === before.groups, 'group count changed');
  assert(after.groupMembers === before.groupMembers, 'group_members count changed');

  const modes = await client.query(
    `SELECT group_mode, count(*)::int AS n FROM classrooms GROUP BY group_mode ORDER BY group_mode`,
  );
  console.log('AFTER classrooms.group_mode distribution:');
  if (modes.rows.length === 0) console.log('  (no classrooms)');
  for (const r of modes.rows) console.log(`  ${r.group_mode}: ${r.n}`);
  const nonNullLimits = await client.query(`SELECT count(*)::int AS n FROM groups WHERE max_members IS NOT NULL`);
  console.log(`AFTER groups with max_members set: ${nonNullLimits.rows[0].n} (expected 0)`);
  assert(nonNullLimits.rows[0].n === 0, 'groups.max_members should start NULL everywhere');
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
