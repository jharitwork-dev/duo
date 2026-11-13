// Learning materials ("สื่อการเรียน", quick task 261113-lz7) — read models.
// getClassroomMaterials does NO authorization (the teacher page authorizes first).
// getStudentMaterials authorizes membership itself and hides archived-phase materials (D-04).
// File keys are never returned; downloads go through getMaterialFileUrl.

import { db } from '@/db';
import { materials, materialFiles } from '@/db/schema/materials';
import { phases } from '@/db/schema/phases';
import { classroomMembers } from '@/db/schema/classrooms';
import { and, asc, eq, inArray, or, isNull, sql } from 'drizzle-orm';

export interface MaterialFileItem {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface MaterialItem {
  id: string;
  title: string;
  description: string | null;
  linkUrl: string | null;
  phaseId: string | null;
  phaseName: string | null;
  phaseOrder: number | null;
  phaseArchived: boolean;
  orderIndex: number;
  files: MaterialFileItem[];
}

async function loadMaterials(classroomId: string, opts: { excludeArchived: boolean }): Promise<MaterialItem[]> {
  const where = opts.excludeArchived
    ? and(eq(materials.classroomId, classroomId), or(isNull(materials.phaseId), eq(phases.isArchived, false)))
    : eq(materials.classroomId, classroomId);
  const rows = await db
    .select({
      id: materials.id,
      title: materials.title,
      description: materials.description,
      linkUrl: materials.linkUrl,
      phaseId: materials.phaseId,
      phaseName: phases.name,
      phaseOrder: phases.orderIndex,
      phaseArchived: phases.isArchived,
      orderIndex: materials.orderIndex,
    })
    .from(materials)
    .leftJoin(phases, eq(phases.id, materials.phaseId))
    .where(where)
    .orderBy(
      sql`${materials.phaseId} IS NOT NULL`,
      asc(phases.orderIndex),
      asc(materials.orderIndex),
      asc(materials.createdAt),
    );
  if (rows.length === 0) return [];

  const files = await db
    .select({
      id: materialFiles.id,
      materialId: materialFiles.materialId,
      fileName: materialFiles.fileName,
      contentType: materialFiles.contentType,
      fileSize: materialFiles.fileSize,
    })
    .from(materialFiles)
    .where(
      inArray(
        materialFiles.materialId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(materialFiles.createdAt));
  const byMaterial = new Map<string, MaterialFileItem[]>();
  for (const f of files) {
    const list = byMaterial.get(f.materialId) ?? [];
    list.push({ id: f.id, fileName: f.fileName, contentType: f.contentType, fileSize: f.fileSize });
    byMaterial.set(f.materialId, list);
  }

  return rows.map((r) => ({
    ...r,
    phaseArchived: r.phaseArchived ?? false,
    files: byMaterial.get(r.id) ?? [],
  }));
}

/** Every material of the classroom (incl. archived phases). Caller must already be a classroom editor. */
export async function getClassroomMaterials(classroomId: string): Promise<MaterialItem[]> {
  return loadMaterials(classroomId, { excludeArchived: false });
}

/** Materials visible to a classroom member: [] for non-members; archived-phase materials excluded. */
export async function getStudentMaterials(classroomId: string, userId: string): Promise<MaterialItem[]> {
  const [member] = await db
    .select({ userId: classroomMembers.userId })
    .from(classroomMembers)
    .where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId)));
  if (!member) return [];
  return loadMaterials(classroomId, { excludeArchived: true });
}
