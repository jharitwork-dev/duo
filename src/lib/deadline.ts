// Deadline rules + formatting (quick task 261004-03i). Pure: no DB / React imports.
//
// Every Date is a UTC instant (Drizzle reads `timestamp without time zone` columns as UTC).
// Comparisons use getTime() only; display is fixed to Asia/Bangkok (UTC+7, no DST), so the
// results never depend on the server's or the browser's process time zone.

import { formatSubmissionDate } from '@/lib/format';
import type { SubmissionStatus } from '@/lib/node-path';

export const DUE_SOON_MS = 48 * 3600_000;
export const DEFAULT_DEADLINE_TIME = '23:59';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const BANGKOK_OFFSET_MS = 7 * HOUR_MS;

export type DeadlineStatus = 'none' | 'upcoming' | 'due_soon' | 'overdue' | 'on_time' | 'late';

export interface DeadlineStatusResult {
  status: DeadlineStatus;
  /** late: first submission − deadline. */
  lateMs?: number;
  /** overdue: now − deadline (nothing submitted yet). */
  overdueMs?: number;
  /** upcoming / due_soon: deadline − now. */
  remainingMs?: number;
}

export const DEADLINE_STATUS_LABEL: Record<Exclude<DeadlineStatus, 'none' | 'upcoming'>, string> = {
  overdue: 'เลยกำหนด',
  due_soon: 'ใกล้ถึงกำหนด',
  on_time: 'ส่งตรงเวลา',
  late: 'ส่งช้า',
};

export const LATENESS_HELP = 'ระบบนับเวลาจากการส่งครั้งแรก การส่งแก้ไขภายหลังไม่ทำให้กลายเป็นส่งช้า';

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Effective deadline of a to-do: its own deadline, else its phase's, else null. */
export function getEffectiveDeadline(
  todo: { deadline: Date | string | null },
  phase: { deadline: Date | string | null } | null | undefined,
): Date | null {
  return toDate(todo.deadline) ?? toDate(phase?.deadline) ?? null;
}

/**
 * Deadline status for one owner (group, or student for individual to-dos).
 * - Submitted at least once → judged on the FIRST submission: on_time (≤ deadline) or late.
 *   A later resubmission (after ต้องแก้ไข) never changes it; `latestStatus` is informational only.
 * - Not submitted → overdue once now > deadline, due_soon within DUE_SOON_MS, otherwise upcoming.
 *   Exactly at the deadline is still due_soon (not yet passed).
 */
export function getDeadlineStatus(input: {
  deadline: DateInput;
  firstSubmittedAt: DateInput;
  latestStatus?: SubmissionStatus;
  now: Date;
}): DeadlineStatusResult {
  const deadline = toDate(input.deadline);
  if (!deadline) return { status: 'none' };
  const d = deadline.getTime();
  const first = toDate(input.firstSubmittedAt);
  if (first) {
    const late = first.getTime() - d;
    return late > 0 ? { status: 'late', lateMs: late } : { status: 'on_time' };
  }
  const now = input.now.getTime();
  if (now > d) return { status: 'overdue', overdueMs: now - d };
  const remaining = d - now;
  return { status: remaining <= DUE_SOON_MS ? 'due_soon' : 'upcoming', remainingMs: remaining };
}

// ---------------------------------------------------------------------------------------------
// Formatting (Asia/Bangkok)

const bangkokDayMonth = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Bangkok',
});

/** "ส่งภายใน 18 ต.ค. 23.59" */
export function formatDeadline(date: Date | string): string {
  return `ส่งภายใน ${formatSubmissionDate(date)}`;
}

/** "18 ต.ค." (Bangkok calendar day) */
export function formatDeadlineDate(date: Date | string): string {
  return bangkokDayMonth.format(new Date(date));
}

/** "ส่งภายใน 18 ต.ค." (no time; node path / compact rows) */
export function formatDeadlineShort(date: Date | string): string {
  return `ส่งภายใน ${formatDeadlineDate(date)}`;
}

/** Floors to the largest whole unit: "2 วัน" / "5 ชม." / "30 นาที" (at least 1 นาที). */
function formatSpan(ms: number): string {
  const abs = Math.abs(ms);
  if (abs >= DAY_MS) return `${Math.floor(abs / DAY_MS)} วัน`;
  if (abs >= HOUR_MS) return `${Math.floor(abs / HOUR_MS)} ชม.`;
  return `${Math.max(1, Math.floor(abs / MINUTE_MS))} นาที`;
}

/** "อีก 2 วัน" / "เหลือ 5 ชม." / "เหลือ 30 นาที" / "เลยกำหนด 1 วัน". */
export function formatDeadlineRelative(deadline: Date | string, now: Date): string {
  const left = new Date(deadline).getTime() - now.getTime();
  if (left < 0) return `เลยกำหนด ${formatSpan(left)}`;
  if (left >= DAY_MS) return `อีก ${formatSpan(left)}`;
  return `เหลือ ${formatSpan(left)}`;
}

/** "ช้า 2 วัน" / "ช้า 3 ชม." / "ช้า 5 นาที". */
export function formatLateness(ms: number): string {
  return `ช้า ${formatSpan(ms)}`;
}

// ---------------------------------------------------------------------------------------------
// Date + time inputs (always Bangkok, independent of the browser's time zone)

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/** Bangkok "YYYY-MM-DD" + "HH:mm" → UTC instant; null for anything invalid. */
export function bangkokInputToUtc(date: string, time: string): Date | null {
  const dm = DATE_RE.exec(date);
  const tm = TIME_RE.exec(time);
  if (!dm || !tm) return null;
  const [y, m, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [hh, mm] = [Number(tm[1]), Number(tm[2])];
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  // Reject rollovers such as 2026-02-30.
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - BANGKOK_OFFSET_MS);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC instant → Bangkok { date: "YYYY-MM-DD", time: "HH:mm" } for date/time inputs. */
export function utcToBangkokInput(value: Date | string): { date: string; time: string } {
  const b = new Date(new Date(value).getTime() + BANGKOK_OFFSET_MS);
  return {
    date: `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}`,
    time: `${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`,
  };
}

/** Bangkok calendar day key "YYYY-MM-DD" (same-day comparisons). */
export function bangkokDayKey(value: Date | string): string {
  return utcToBangkokInput(value).date;
}
