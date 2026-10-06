// Pure group-responsibility + classroom teacher rank decisions (no DB / framework imports).
import { ERR_NOT_A_TEACHER, ERR_TEACHER_NOT_FOUND, type TeacherDecision } from '@/lib/classroom-teachers';

export const TEACHER_RANKS = ['teacher', 'assistant'] as const;
export type TeacherRank = (typeof TEACHER_RANKS)[number];

/** Display-only rank labels (rank never changes permissions). */
export const TEACHER_RANK_LABEL: Record<TeacherRank, string> = {
  teacher: 'ครู',
  assistant: 'ผู้ช่วยครู',
};

export const ERR_OWNER_RANK_FIXED = 'เจ้าของห้องเรียนเป็นครูเสมอ เปลี่ยนตำแหน่งไม่ได้';
export const ERR_INVALID_RANK = 'ตำแหน่งไม่ถูกต้อง';
export const ERR_ASSIGN_OTHERS = 'เฉพาะเจ้าของห้องเรียนหรือแอดมินเท่านั้นที่กำหนดครูคนอื่นให้ดูแลกลุ่มได้';
export const ERR_SELF_NOT_TEACHER = 'คุณไม่ได้เป็นครูของห้องเรียนนี้';

type MemberRole = 'teacher' | 'student' | null;

export function isTeacherRank(v: unknown): v is TeacherRank {
  return typeof v === 'string' && (TEACHER_RANKS as readonly string[]).includes(v);
}

/** Owner is always ครู; null/unknown ranks show as ครู. */
export function effectiveTeacherRank(input: {
  userId: string;
  createdBy: string;
  rank: string | null | undefined;
}): TeacherRank {
  if (input.userId === input.createdBy) return 'teacher';
  return isTeacherRank(input.rank) ? input.rank : 'teacher';
}

/** Classroom teacher = owner, or a classroom_members row with role 'teacher'. */
export function isClassroomTeacher(input: { userId: string; createdBy: string; memberRole: MemberRole }): boolean {
  if (input.userId === input.createdBy) return true;
  return input.memberRole === 'teacher';
}

export function decideSetTeacherRank(input: {
  targetUserId: string;
  createdBy: string;
  memberRole: MemberRole;
  rank: string;
}): TeacherDecision {
  if (input.targetUserId === input.createdBy) return { ok: false, error: ERR_OWNER_RANK_FIXED };
  if (input.memberRole === null) return { ok: false, error: ERR_TEACHER_NOT_FOUND };
  if (input.memberRole !== 'teacher') return { ok: false, error: ERR_NOT_A_TEACHER };
  if (!isTeacherRank(input.rank)) return { ok: false, error: ERR_INVALID_RANK };
  return { ok: true };
}

/**
 * Self-service: a classroom teacher may (un)mark themselves.
 * Override: only owner/superadmin (canManage) may change other teachers.
 */
export function decideGroupTeacherChange(input: {
  actorUserId: string;
  targetUserId: string;
  canManage: boolean;
  targetIsClassroomTeacher: boolean;
}): TeacherDecision {
  if (input.actorUserId === input.targetUserId) {
    return input.targetIsClassroomTeacher ? { ok: true } : { ok: false, error: ERR_SELF_NOT_TEACHER };
  }
  if (!input.canManage) return { ok: false, error: ERR_ASSIGN_OTHERS };
  if (!input.targetIsClassroomTeacher) return { ok: false, error: ERR_NOT_A_TEACHER };
  return { ok: true };
}

/** name is a publicName (safe to show students; never an email). */
export interface ResponsibleTeacher {
  userId: string;
  name: string;
  rank: TeacherRank;
}

const RANK_ORDER: Record<TeacherRank, number> = { teacher: 0, assistant: 1 };

export function sortResponsibleTeachers<T extends { name: string; rank: TeacherRank }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || a.name.localeCompare(b.name, 'th'));
}

export function formatResponsibleTeachers<T extends { name: string; rank: TeacherRank }>(list: readonly T[]): string {
  return list.map((t) => `${t.name} (${TEACHER_RANK_LABEL[t.rank]})`).join(', ');
}
