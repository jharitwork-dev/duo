/**
 * Ops (user request 2026-10-04): create the Cocoon 2026 team groups (deduped) (groups only — to-dos are
 * assigned by the teacher afterwards). Skips names that already exist.
 * Run: npx tsx src/db/migrations/2026-10-04-cocoon-2026-groups.ts --dry-run | --apply
 */
import { db } from '@/db';
import { classrooms } from '@/db/schema/classrooms';
import { groups } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { phaseTemplates } from '@/db/schema/phaseTemplates';
import { asc, eq } from 'drizzle-orm';
import { parseTemplateStructure } from '@/lib/template-structure';
import { syncClassroomProgress } from '@/server/phase-helpers';

const ACTOR = 'user_3JuDNaxgc1gocac9wHnDHmXcgTE';
const NAMES = ['TROPHI', 'Reese', 'Tiwalai', 'BEVA', 'Myth/Myth', 'BARE', 'Man-ttok', 'Blind life wai lai', 'LUI',
  'Hyper trio / COOLÉ', 'Tomato Tomato/Nō Meiku', 'Silvara', 'CTRL Z', 'Undermood', 'คุกคามวิดกบด (WKB)'];
class Rollback extends Error {}

async function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--dry-run') ? 'dry-run' : null;
  if (!mode) throw new Error('Pass --dry-run or --apply');
  const classroom = await db.query.classrooms.findFirst({ where: eq(classrooms.name, 'Cocoon 2026') });
  if (!classroom) throw new Error('Cocoon 2026 not found');
  const tpl = await db.query.phaseTemplates.findFirst({ where: eq(phaseTemplates.name, 'Cocoon Incubation') });
  if (!tpl) throw new Error('template missing');
  const structure = parseTemplateStructure(tpl.structure);
  const classPhases = await db.select().from(phases).where(eq(phases.classroomId, classroom.id)).orderBy(asc(phases.orderIndex));
  const existing = new Set((await db.select({ name: groups.name }).from(groups).where(eq(groups.classroomId, classroom.id))).map((g) => g.name.trim().toLowerCase()));
  const toCreate = NAMES.filter((n) => !existing.has(n.trim().toLowerCase()));
  console.log(`MODE ${mode} · classroom phases=${classPhases.map((p) => p.name).join(' | ')} · create ${toCreate.length}/${NAMES.length}`);
  try {
    await db.transaction(async (tx) => {
      for (const name of toCreate) {
        await tx.insert(groups).values({ classroomId: classroom.id, name, createdBy: ACTOR });
      }
      await syncClassroomProgress(tx, classroom.id);
      const all = await tx.select({ name: groups.name }).from(groups).where(eq(groups.classroomId, classroom.id));
      console.log(`AFTER groups=${all.length}: ${all.map((g) => g.name).join(', ')}`);
      if (mode === 'dry-run') throw new Rollback();
    });
    console.log('APPLIED — committed');
  } catch (e) { if (e instanceof Rollback) { console.log('DRY RUN — rolled back'); return; } throw e; }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
