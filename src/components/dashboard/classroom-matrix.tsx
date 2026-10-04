'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from 'cn';
import { CARD, SELECT } from '@/components/cocoon/ui';
import { StatusPill } from '@/components/cocoon/status-pill';
import { DeadlineChip } from '@/components/deadline/deadline-chip';
import { formatDeadline } from '@/lib/deadline';
import { formatSubmissionDate } from '@/lib/format';
import {
  filterMatrixRows,
  type ClassroomDashboard,
  type DashboardCell,
  type MatrixRow,
} from '@/lib/deadline-dashboard';

type MatrixData = Pick<ClassroomDashboard, 'phases' | 'groups' | 'rows'>;

function rowDeadlineLabel(row: MatrixRow): string {
  if (!row.deadline) return 'ไม่มีกำหนดส่ง';
  return `${formatDeadline(row.deadline)}${row.mixedDeadlines ? ' (แต่ละกลุ่มไม่เท่ากัน)' : ''}`;
}

function CellBody({ cell }: { cell: DashboardCell }) {
  const pendingLabel = cell.reviewStatus === 'pending' && cell.pendingCount > 1 ? `รอตรวจ ${cell.pendingCount}` : undefined;
  return (
    <>
      <span className="flex flex-wrap items-center gap-1">
        <StatusPill status={cell.reviewStatus} label={pendingLabel} />
        <DeadlineChip status={cell.deadlineStatus} lateMs={cell.lateMs} overdueMs={cell.overdueMs} />
      </span>
      {(cell.latestSubmittedAt || cell.submissionMode === 'individual') && (
        <span className="text-[11px] font-medium text-cocoon-muted">
          {cell.latestSubmittedAt && `ส่ง ${formatSubmissionDate(cell.latestSubmittedAt)}`}
          {cell.latestSubmittedAt && cell.submissionMode === 'individual' && ' · '}
          {cell.submissionMode === 'individual' && `${cell.submittedCount}/${cell.ownerCount} คน`}
        </span>
      )}
    </>
  );
}

/**
 * Classroom "ภาพรวม" matrix (261004-03i): rows = to-dos (copies sharing assignment_id or the same
 * title within a phase are one row), columns = groups. Desktop table, mobile cards.
 */
export function ClassroomMatrix({ dashboard }: { dashboard: MatrixData }) {
  const [phaseId, setPhaseId] = useState('');
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');

  const { rows, groupIds } = useMemo(
    () => filterMatrixRows(dashboard.rows, dashboard.groups, { phaseId: phaseId || null, problemsOnly, groupQuery }),
    [dashboard.rows, dashboard.groups, phaseId, problemsOnly, groupQuery],
  );
  const groupName = useMemo(() => new Map(dashboard.groups.map((g) => [g.id, g.name])), [dashboard.groups]);
  const phaseIndex = useMemo(() => new Map(dashboard.phases.map((p, i) => [p.id, i])), [dashboard.phases]);
  const phaseName = (id: string) => dashboard.phases.find((p) => p.id === id)?.name ?? '';

  // Phase header rows: rows are already ordered by phase.
  const sections: { phaseId: string; rows: MatrixRow[] }[] = [];
  for (const row of rows) {
    const last = sections[sections.length - 1];
    if (last && last.phaseId === row.phaseId) last.rows.push(row);
    else sections.push({ phaseId: row.phaseId, rows: [row] });
  }

  if (dashboard.rows.length === 0) {
    return (
      <section className={CARD}>
        <p className="text-[14px] font-medium text-cocoon-muted">ยังไม่มีงานในห้องเรียนนี้</p>
      </section>
    );
  }

  return (
    <section aria-label="ตารางสถานะงาน" className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="กรอง Phase"
          className={cn(SELECT, 'max-w-full')}
          value={phaseId}
          onChange={(e) => setPhaseId(e.target.value)}
        >
          <option value="">ทุก Phase</option>
          {dashboard.phases.map((p, i) => (
            <option key={p.id} value={p.id}>
              Phase {i + 1} · {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={problemsOnly}
          onClick={() => setProblemsOnly((v) => !v)}
          className={cn(
            'h-10 rounded-full border px-4 text-[14px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40',
            problemsOnly
              ? 'border-[#d11a0f] bg-[rgba(255,27,15,.1)] text-[#d11a0f]'
              : 'border-[#f1ece5] bg-white text-cocoon-blue hover:bg-cocoon-blue-soft',
          )}
        >
          เฉพาะที่มีปัญหา
        </button>
        <label className="relative min-w-[160px] flex-1 lg:max-w-[260px]">
          <span className="sr-only">ค้นหากลุ่ม</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-cocoon-muted" aria-hidden />
          <input
            type="search"
            value={groupQuery}
            onChange={(e) => setGroupQuery(e.target.value)}
            placeholder="ค้นหากลุ่ม"
            className={cn(SELECT, 'w-full pl-9')}
          />
        </label>
      </div>

      {rows.length === 0 || groupIds.length === 0 ? (
        <div className={CARD}>
          <p className="text-[14px] font-medium text-cocoon-muted">ไม่มีงานที่ตรงกับตัวกรอง</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-[16px] border border-[#f1ece5] bg-white lg:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f1ece5]">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-[240px] bg-white px-4 py-3 text-[13px] font-bold text-cocoon-muted"
                  >
                    งาน
                  </th>
                  {groupIds.map((id) => (
                    <th key={id} scope="col" className="min-w-[170px] px-3 py-3 text-[13px] font-bold text-cocoon-ink">
                      {groupName.get(id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <Fragment key={section.phaseId}>
                    <tr className="bg-cocoon-cream/60">
                      <th
                        scope="colgroup"
                        colSpan={groupIds.length + 1}
                        className="sticky left-0 px-4 py-2 text-[13px] font-bold text-cocoon-blue"
                      >
                        Phase {(phaseIndex.get(section.phaseId) ?? 0) + 1} · {phaseName(section.phaseId)}
                      </th>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={row.key} className="border-b border-[#f1ece5] last:border-b-0">
                        <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 align-top">
                          <span className="block text-[14px] leading-snug font-bold text-cocoon-ink">{row.title}</span>
                          <span className="block text-[12px] font-medium text-cocoon-muted">{rowDeadlineLabel(row)}</span>
                        </th>
                        {groupIds.map((gid) => {
                          const cell = row.cells[gid] ?? null;
                          return (
                            <td key={gid} className="px-3 py-3 align-top">
                              {cell ? (
                                <Link
                                  href={`/todo/${cell.todoId}`}
                                  className="flex flex-col gap-1 rounded-[8px] p-1 outline-none hover:bg-cocoon-blue-soft/60 focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
                                >
                                  <CellBody cell={cell} />
                                </Link>
                              ) : (
                                <span className="text-[14px] text-cocoon-disabled" aria-label="ไม่มีงานนี้">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-4 lg:hidden">
            {sections.map((section) => (
              <div key={section.phaseId} className="space-y-2">
                <h3 className="text-[13px] font-bold text-cocoon-blue">
                  Phase {(phaseIndex.get(section.phaseId) ?? 0) + 1} · {phaseName(section.phaseId)}
                </h3>
                {section.rows.map((row) => (
                  <div key={row.key} className={cn(CARD, 'space-y-2 p-4')}>
                    <div>
                      <p className="text-[15px] leading-snug font-bold break-words text-cocoon-ink">{row.title}</p>
                      <p className="text-[12px] font-medium text-cocoon-muted">{rowDeadlineLabel(row)}</p>
                    </div>
                    <ul className="divide-y divide-[#f1ece5]">
                      {groupIds.map((gid) => {
                        const cell = row.cells[gid] ?? null;
                        return (
                          <li key={gid}>
                            {cell ? (
                              <Link
                                href={`/todo/${cell.todoId}`}
                                className="flex items-start justify-between gap-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
                              >
                                <span className="min-w-0 truncate text-[13px] font-bold text-cocoon-ink">
                                  {groupName.get(gid)}
                                </span>
                                <span className="flex flex-col items-end gap-1">
                                  <CellBody cell={cell} />
                                </span>
                              </Link>
                            ) : (
                              <span className="flex items-center justify-between gap-2 py-2">
                                <span className="min-w-0 truncate text-[13px] font-bold text-cocoon-ink">
                                  {groupName.get(gid)}
                                </span>
                                <span className="text-[13px] text-cocoon-disabled">—</span>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
