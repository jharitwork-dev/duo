import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';
import { cn } from 'cn';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getFormResponsesView } from '@/server/queries/form';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { BTN_INFO, PAGE_BODY, PILL_CAPACITY } from '@/components/cocoon/ui';
import { MineFilterToggle, MINE_FILTER_EMPTY_HINT } from '@/components/group/mine-filter-toggle';
import { FormResponsesView } from '@/components/form/form-responses-view';

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const CHIP = cn(PILL_CAPACITY, 'h-[36px] px-4 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40');

// Teacher form responses (quick task 261021-r1c). getFormResponsesView authorizes (classroom editor).
export default async function FormResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ classroomId: string; formId: string }>;
  searchParams: Promise<{ group?: string | string[]; mine?: string | string[] }>;
}) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const { classroomId, formId } = await params;
  const sp = await searchParams;
  const mine = first(sp.mine) === '1';

  const data = await getFormResponsesView(formId, userId, { groupId: first(sp.group) ?? null, mine });
  if (!data || data.classroom.id !== classroomId) notFound();

  const base = `/teacher/classroom/${classroomId}/forms/${formId}`;
  const groupId = data.filters.groupId;
  const query = (g: string | null, m: boolean) => {
    const qs = new URLSearchParams();
    if (g) qs.set('group', g);
    if (m) qs.set('mine', '1');
    const s = qs.toString();
    return s ? `?${s}` : '';
  };
  const filteredToNothing = mine && data.rows.length === 0 && data.counts.expected === 0;

  return (
    <>
      <CocoonHeader variant="back" backHref={base} />
      <PageHeader
        backHref={base}
        backLabel="แก้ไขแบบฟอร์ม"
        title={`คำตอบ: ${data.form.title}`}
        subtitle={data.classroom.name}
        actions={
          <>
            <MineFilterToggle href={`${base}/responses${query(groupId, !mine)}`} active={mine} />
            {/* Plain anchor: a route handler download, never prefetched. */}
            <a
              href={`${base}/export${query(groupId, mine)}`}
              download
              className={cn(BTN_INFO, 'inline-flex h-10 items-center gap-2 text-[14px]')}
            >
              <Download className="size-4" aria-hidden />
              Export CSV
            </a>
          </>
        }
      />
      <div className={cn(PAGE_BODY, 'space-y-4 lg:space-y-6')}>
        {data.groups.length > 0 && (
          <nav aria-label="กรองตามกลุ่ม" className="flex flex-wrap gap-2">
            <Link
              href={`${base}/responses${query(null, mine)}`}
              aria-current={groupId === null ? 'true' : undefined}
              className={cn(CHIP, groupId === null ? 'bg-cocoon-blue text-white' : 'border border-cocoon-blue/40 bg-white')}
            >
              ทั้งหมด
            </Link>
            {data.groups.map((g) => (
              <Link
                key={g.id}
                href={`${base}/responses${query(g.id, mine)}`}
                aria-current={groupId === g.id ? 'true' : undefined}
                className={cn(CHIP, groupId === g.id ? 'bg-cocoon-blue text-white' : 'border border-cocoon-blue/40 bg-white')}
              >
                {g.name}
              </Link>
            ))}
          </nav>
        )}
        {filteredToNothing && (
          <p className="rounded-[12px] bg-cocoon-blue-soft px-4 py-3 text-[14px] font-bold text-cocoon-blue">
            {MINE_FILTER_EMPTY_HINT}
          </p>
        )}
        <FormResponsesView data={data} />
      </div>
    </>
  );
}
