/**
 * Data migration 2026-10-04: move Clerk user ids from the dev instance to the production instance.
 *
 * The prod instance does not share user ids with dev. Matching prod users were created with the same
 * email + public_metadata.role; this rewrites every user-id column in the DB from the dev id to the prod id.
 *
 * Mapping (by email):
 *   jharit.work@gmail.com  user_3JuDNaxgc1gocac9wHnDHmXcgTE -> user_3KDxOliReYK6sB5i1aZr9gqyoST
 *   jharit3@gmail.com      user_3KByDIcCpJtkX3IC90RajijN9Hh -> user_3KDxOkFuCDkHBQuM72WRgM8xWao
 *
 * Columns: every public text column named user_id / created_by / submitted_by / reviewed_by /
 * uploaded_by / updated_by (discovered from information_schema, so new tables are covered).
 *
 * Run (from the repo root):
 *   npx tsx src/db/migrations/2026-10-04-clerk-prod-user-ids.ts --dry-run   # runs everything, then ROLLBACK
 *   npx tsx src/db/migrations/2026-10-04-clerk-prod-user-ids.ts --apply     # runs everything, then COMMIT
 *
 * WARNING: DATABASE_URL is shared with the LIVE site. Apply together with switching Vercel Production to
 * the pk_live/sk_live keys: after --apply, the dev-instance sessions no longer match any membership.
 *
 * Idempotent: if no dev id remains anywhere it prints "already migrated" and exits 0. One transaction;
 * any failed assertion throws and rolls back.
 */

import { config } from 'dotenv';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

neonConfig.webSocketConstructor = ws;

const USAGE = 'Usage: npx tsx src/db/migrations/2026-10-04-clerk-prod-user-ids.ts (--dry-run | --apply)';

const ID_MAP: Record<string, string> = {
  user_3JuDNaxgc1gocac9wHnDHmXcgTE: 'user_3KDxOliReYK6sB5i1aZr9gqyoST',
  user_3KByDIcCpJtkX3IC90RajijN9Hh: 'user_3KDxOkFuCDkHBQuM72WRgM8xWao',
};

const USER_COLUMNS = ['user_id', 'created_by', 'submitted_by', 'reviewed_by', 'uploaded_by', 'updated_by'];

type Col = { table: string; column: string };

async function userColumns(client: PoolClient): Promise<Col[]> {
  const res = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND data_type = 'text' AND column_name = ANY($1)
     ORDER BY table_name, column_name`,
    [USER_COLUMNS],
  );
  return res.rows.map((r) => ({ table: r.table_name as string, column: r.column_name as string }));
}

async function countIds(client: PoolClient, cols: Col[], ids: string[]): Promise<number> {
  let n = 0;
  for (const { table, column } of cols) {
    const res = await client.query(`SELECT count(*)::int AS n FROM "${table}" WHERE "${column}" = ANY($1)`, [ids]);
    n += res.rows[0].n as number;
  }
  return n;
}

async function main() {
  const mode = process.argv[2];
  if (mode !== '--dry-run' && mode !== '--apply') {
    console.error(USAGE);
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const oldIds = Object.keys(ID_MAP);
  const newIds = Object.values(ID_MAP);
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    const cols = await userColumns(client);

    const oldBefore = await countIds(client, cols, oldIds);
    const newBefore = await countIds(client, cols, newIds);
    if (oldBefore === 0) {
      console.log(`already migrated (dev ids: 0, prod ids: ${newBefore})`);
      await client.query('ROLLBACK');
      return;
    }
    if (newBefore !== 0) throw new Error(`prod ids already present (${newBefore}) alongside dev ids — aborting`);

    let updated = 0;
    for (const { table, column } of cols) {
      for (const [from, to] of Object.entries(ID_MAP)) {
        const res = await client.query(`UPDATE "${table}" SET "${column}" = $2 WHERE "${column}" = $1`, [from, to]);
        if (res.rowCount) console.log(`  ${table}.${column}: ${from} -> ${to} (${res.rowCount})`);
        updated += res.rowCount ?? 0;
      }
    }

    const oldAfter = await countIds(client, cols, oldIds);
    const newAfter = await countIds(client, cols, newIds);
    if (oldAfter !== 0) throw new Error(`dev ids remain after update: ${oldAfter}`);
    if (newAfter !== oldBefore || updated !== oldBefore) {
      throw new Error(`count mismatch: before=${oldBefore} updated=${updated} after=${newAfter}`);
    }
    console.log(`OK: ${updated} references remapped across ${cols.length} columns`);

    await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
    console.log(mode === '--apply' ? 'COMMITTED' : 'DRY RUN — rolled back');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
