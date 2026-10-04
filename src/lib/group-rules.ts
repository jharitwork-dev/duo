// Pure grouping rules (no DB / framework imports) shared by server actions and UI.

export const GROUP_MODES = ['teacher', 'self_join', 'self_create'] as const;
export type GroupMode = (typeof GROUP_MODES)[number];

export const GROUP_MODE_LABELS: Record<GroupMode, string> = {
  teacher: 'ครูจัดกลุ่มให้',
  self_join: 'นักเรียนเลือกกลุ่มเอง',
  self_create: 'นักเรียนสร้างและเลือกกลุ่มเอง',
};

export const GROUP_MODE_DESCRIPTIONS: Record<GroupMode, string> = {
  teacher: 'นักเรียนรอให้ครูเพิ่มเข้ากลุ่ม',
  self_join: 'นักเรียนเลือกเข้าร่วมกลุ่มที่ครูสร้างไว้',
  self_create: 'นักเรียนสร้างกลุ่มใหม่หรือเลือกกลุ่มที่มีอยู่',
};

export const MAX_GROUP_LIMIT = 50;

export type RuleResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): RuleResult => ({ ok: false, error });
const OK: RuleResult = { ok: true };

/** group.max_members ?? classroom.max_group_size ?? unlimited (null). */
export function effectiveGroupLimit(
  groupMax: number | null | undefined,
  classroomMax: number | null | undefined,
): number | null {
  return groupMax ?? classroomMax ?? null;
}

export function isGroupFull(memberCount: number, limit: number | null): boolean {
  return limit !== null && memberCount >= limit;
}

/** Warning shown when a limit is lowered below the current member count (nobody is removed). */
export function limitWarning(newLimit: number | null, memberCount: number): string | null {
  if (newLimit === null || memberCount <= newLimit) return null;
  return `กลุ่มนี้มีสมาชิก ${memberCount} คน มากกว่าจำนวนสูงสุดใหม่ (${newLimit} คน) — ไม่มีใครถูกนำออก แต่จะเพิ่มสมาชิกใหม่ไม่ได้`;
}

export function capacityLabel(count: number, limit: number | null): string {
  return limit === null ? `${count} คน` : `${count}/${limit} คน`;
}

export function groupFullError(memberCount: number, limit: number): string {
  return `กลุ่มนี้เต็มแล้ว (${memberCount}/${limit} คน)`;
}

export function canStudentJoinGroup(input: {
  mode: GroupMode;
  hasGroup: boolean;
  memberCount: number;
  limit: number | null;
}): RuleResult {
  if (input.mode === 'teacher') return fail('ห้องเรียนนี้ให้ครูเป็นผู้จัดกลุ่ม — รอครูเพิ่มเข้ากลุ่ม');
  if (input.hasGroup) return fail('คุณอยู่ในกลุ่มของห้องเรียนนี้แล้ว — ออกจากกลุ่มเดิมก่อน');
  if (input.limit !== null && isGroupFull(input.memberCount, input.limit)) {
    return fail(groupFullError(input.memberCount, input.limit));
  }
  return OK;
}

export function canStudentCreateGroup(input: { mode: GroupMode; hasGroup: boolean }): RuleResult {
  if (input.mode !== 'self_create') return fail('ห้องเรียนนี้ไม่เปิดให้นักเรียนสร้างกลุ่มเอง');
  if (input.hasGroup) return fail('คุณอยู่ในกลุ่มของห้องเรียนนี้แล้ว — ออกจากกลุ่มเดิมก่อน');
  return OK;
}

export function canStudentLeaveGroup(input: { mode: GroupMode; groupHasSubmissions: boolean }): RuleResult {
  if (input.mode === 'teacher') return fail('ห้องเรียนนี้ให้ครูเป็นผู้จัดกลุ่ม — ติดต่อครูหากต้องการย้ายกลุ่ม');
  if (input.groupHasSubmissions) {
    return fail('กลุ่มนี้ส่งงานไปแล้ว จึงออกจากกลุ่มเองไม่ได้ — ติดต่อครูหากต้องการย้ายกลุ่ม');
  }
  return OK;
}

/**
 * Type-to-confirm rule for destructive deletes: required when anything was submitted,
 * or always (alwaysRequire, e.g. classroom delete). Compared after trimming.
 */
export function checkDeleteConfirmation(input: {
  submissionCount: number;
  expectedName: string;
  typed: string | undefined | null;
  alwaysRequire?: boolean;
}): RuleResult {
  const required = input.alwaysRequire || input.submissionCount > 0;
  if (!required) return OK;
  if ((input.typed ?? '').trim() !== input.expectedName.trim()) {
    return fail(`พิมพ์ชื่อ "${input.expectedName.trim()}" ให้ตรงเพื่อยืนยันการลบ`);
  }
  return OK;
}

export type DeleteGroupDecision = { ok: true; requiresConfirmation: boolean } | { ok: false; error: string };

/**
 * Who may delete a group:
 * - a classroom editor (owner / teacher member / superadmin), always; type-to-confirm when submissions exist;
 * - the student who created it, only in self_create mode and only while it has zero submissions;
 * - nobody else.
 */
export function canDeleteGroup(input: {
  isClassroomEditor: boolean;
  isGroupCreator: boolean;
  groupMode: GroupMode;
  submissionCount: number;
}): DeleteGroupDecision {
  if (input.isClassroomEditor) return { ok: true, requiresConfirmation: input.submissionCount > 0 };
  if (!input.isGroupCreator || input.groupMode !== 'self_create') {
    return { ok: false, error: 'คุณไม่มีสิทธิ์ลบกลุ่มนี้' };
  }
  if (input.submissionCount > 0) {
    return { ok: false, error: 'กลุ่มนี้ส่งงานไปแล้ว จึงลบเองไม่ได้ — ติดต่อครู' };
  }
  return { ok: true, requiresConfirmation: false };
}
