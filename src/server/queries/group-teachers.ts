// Responsible teachers ("ครูที่ดูแล") per group — plain server module (quick task 261006-ij6).
// Data reaches students: names are publicName ONLY (never the teacher-facing name or the email).

import { db } from '@/db';
import { classroomMembers, classrooms } from '@/db/schema/classrooms';
import { groups, groupTeachers } from '@/db/schema/groups';
import { and, eq } from 'drizzle-orm';
import {
  effectiveTeacherRank,
  isClassroomTeacher,
  sortResponsibleTeachers,
  type ResponsibleTeacher,
} from '@/lib/group-teachers';
import { getUserDirectory } from '@/lib/user-directory';

/** groupId → sorted responsible teachers for every group of the classroom (groups without any are omitted). */
export async function getGroupTeachersByClassroom(
  classroomId: string,
): Promise<Record<string, ResponsibleTeacher[]>> {
  const [classroom, rows] = await Promise.all([
    db.query.classrooms.findFirst({ where: eq(classrooms.id, classroomId), columns: { createdBy: true } }),
    db
      .select({
        groupId: groupTeachers.groupId,
        userId: groupTeachers.userId,
        memberRole: classroomMembers.role,
        teacherRank: classroomMembers.teacherRank,
      })
      .from(groupTeachers)
      .innerJoin(groups, and(eq(groups.id, groupTeachers.groupId), eq(groups.classroomId, classroomId)))
      .leftJoin(
        classroomMembers,
        and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, groupTeachers.userId)),
      ),
  ]);
  if (!classroom || rows.length === 0) return {};

  const createdBy = classroom.createdBy;
  // D-01 (defensive): only the owner or teacher members can be responsible.
  const valid = rows.filter((r) => isClassroomTeacher({ userId: r.userId, createdBy, memberRole: r.memberRole ?? null }));
  if (valid.length === 0) return {};

  const directory = await getUserDirectory(valid.map((r) => r.userId));
  const result: Record<string, ResponsibleTeacher[]> = {};
  for (const r of valid) {
    const list = (result[r.groupId] ??= []);
    list.push({
      userId: r.userId,
      name: directory.get(r.userId)?.publicName ?? 'ไม่ระบุชื่อ',
      rank: effectiveTeacherRank({ userId: r.userId, createdBy, rank: r.teacherRank }),
    });
  }
  for (const id of Object.keys(result)) result[id] = sortResponsibleTeachers(result[id]);
  return result;
}
