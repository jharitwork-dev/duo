// Pure merge planner for the 2026-10-03 classroom-phases migration (no DB imports — unit tested).
//
// Old model: phases belong to a group. New model: phases belong to the classroom, to-dos
// belong to (phase, group), and each group's phase status lives in group_phase_progress.
// Per classroom, old phase rows are merged by name key (trimmed, lower-case).

export type MergePhaseStatus = 'locked' | 'active' | 'completed';

export interface OldGroupRow {
  id: string;
  classroomId: string;
}

export interface OldPhaseRow {
  id: string;
  groupId: string;
  classroomId: string;
  name: string;
  orderIndex: number;
  status: MergePhaseStatus;
  isArchived: boolean;
  createdAt: Date;
}

export interface ClassroomMergePlan {
  classroomId: string;
  /** Surviving phase rows with their new classroom-level order (0..n-1). */
  survivors: { phaseId: string; orderIndex: number; isArchived: boolean }[];
  /**
   * EXACTLY one entry per ORIGINAL phase row of the classroom. Survivors self-map
   * (oldPhaseId === survivorId). groupId = the old row's group, which becomes the
   * group_id of every to-do that sat on that old row.
   */
  remap: { oldPhaseId: string; survivorId: string; groupId: string }[];
  /** Merged-away (non-survivor) phase rows. */
  deletePhaseIds: string[];
  /** One row per (group in classroom, survivor). */
  progress: { groupId: string; phaseId: string; status: MergePhaseStatus }[];
}

const RANK: Record<MergePhaseStatus, number> = { locked: 0, active: 1, completed: 2 };

export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

function olderFirst(a: OldPhaseRow, b: OldPhaseRow): number {
  const t = a.createdAt.getTime() - b.createdAt.getTime();
  if (t !== 0) return t;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function planClassroom(
  classroomId: string,
  classroomPhases: OldPhaseRow[],
  classroomGroupIds: string[],
): ClassroomMergePlan {
  // 1. Merged order: groups by their earliest phase createdAt, phases by orderIndex.
  const byGroup = new Map<string, OldPhaseRow[]>();
  for (const p of classroomPhases) {
    const list = byGroup.get(p.groupId) ?? [];
    list.push(p);
    byGroup.set(p.groupId, list);
  }
  const groupOrder = [...byGroup.entries()]
    .map(([groupId, rows]) => ({ groupId, first: [...rows].sort(olderFirst)[0] }))
    .sort((a, b) => olderFirst(a.first, b.first) || (a.groupId < b.groupId ? -1 : 1))
    .map((g) => g.groupId);

  const keyOrder: string[] = [];
  const rowsByKey = new Map<string, OldPhaseRow[]>();
  for (const groupId of groupOrder) {
    const rows = [...byGroup.get(groupId)!].sort(
      (a, b) => a.orderIndex - b.orderIndex || olderFirst(a, b),
    );
    for (const row of rows) {
      const key = nameKey(row.name);
      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, []);
        keyOrder.push(key);
      }
      rowsByKey.get(key)!.push(row);
    }
  }

  // 2. Survivor per key = earliest createdAt (tie -> smaller id).
  const survivors: ClassroomMergePlan['survivors'] = [];
  const survivorByKey = new Map<string, string>();
  const deletePhaseIds: string[] = [];
  keyOrder.forEach((key, index) => {
    const rows = rowsByKey.get(key)!;
    const survivor = [...rows].sort(olderFirst)[0];
    survivorByKey.set(key, survivor.id);
    survivors.push({
      phaseId: survivor.id,
      orderIndex: index,
      isArchived: rows.every((r) => r.isArchived),
    });
    for (const r of rows) if (r.id !== survivor.id) deletePhaseIds.push(r.id);
  });

  // 3. Remap: one entry per original row (survivors self-map).
  const remap = classroomPhases.map((row) => ({
    oldPhaseId: row.id,
    survivorId: survivorByKey.get(nameKey(row.name))!,
    groupId: row.groupId,
  }));
  if (remap.length !== classroomPhases.length) {
    throw new Error(`remap invariant violated for classroom ${classroomId}`);
  }

  // 4. Progress matrix for every (group, survivor).
  const firstNonArchived = survivors.find((s) => !s.isArchived)?.phaseId;
  const allGroupIds = [...new Set([...classroomGroupIds, ...byGroup.keys()])];
  const progress: ClassroomMergePlan['progress'] = [];
  for (const groupId of allGroupIds) {
    const ownRows = byGroup.get(groupId) ?? [];
    const statusBySurvivor = new Map<string, MergePhaseStatus>();
    for (const row of ownRows) {
      const survivorId = survivorByKey.get(nameKey(row.name))!;
      const prev = statusBySurvivor.get(survivorId);
      if (prev === undefined || RANK[row.status] > RANK[prev]) {
        statusBySurvivor.set(survivorId, row.status);
      }
    }
    for (const s of survivors) {
      let status: MergePhaseStatus;
      const merged = statusBySurvivor.get(s.phaseId);
      if (merged !== undefined) status = merged;
      else if (ownRows.length > 0) status = 'locked';
      else status = s.phaseId === firstNonArchived ? 'active' : 'locked';
      progress.push({ groupId, phaseId: s.phaseId, status });
    }
  }

  return { classroomId, survivors, remap, deletePhaseIds, progress };
}

/**
 * Plans the merge for every classroom that has at least one phase.
 * Classrooms are planned independently. Empty input -> [].
 */
export function planPhaseMerge(input: {
  groups: OldGroupRow[];
  phases: OldPhaseRow[];
}): ClassroomMergePlan[] {
  const phasesByClassroom = new Map<string, OldPhaseRow[]>();
  for (const p of input.phases) {
    const list = phasesByClassroom.get(p.classroomId) ?? [];
    list.push(p);
    phasesByClassroom.set(p.classroomId, list);
  }

  const plans: ClassroomMergePlan[] = [];
  for (const [classroomId, classroomPhases] of phasesByClassroom) {
    const groupIds = input.groups.filter((g) => g.classroomId === classroomId).map((g) => g.id);
    plans.push(planClassroom(classroomId, classroomPhases, groupIds));
  }
  return plans;
}
