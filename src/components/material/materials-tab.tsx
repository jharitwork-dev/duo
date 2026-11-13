'use client';

// สื่อการเรียน tab on the teacher classroom page (quick task 261113-lz7). Materials are grouped as
// "ทั้งห้องเรียน" first, then one section per phase in phase order. Nothing to submit (D-03).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { BTN_PRIMARY, CARD, EMPTY_CARD } from '@/components/cocoon/ui';
import { deleteMaterial } from '@/server/actions/material';
import type { MaterialItem } from '@/server/queries/material';
import { MaterialDialog, type MaterialPhaseOption } from './material-dialog';
import { MaterialFileButtons } from './material-file-buttons';

type Section = { key: string; label: string; items: MaterialItem[] };

function groupSections(materials: MaterialItem[]): Section[] {
  const sections: Section[] = [];
  const byKey = new Map<string, Section>();
  // Query order: classroom-wide first, then by phase order — keep it.
  for (const m of materials) {
    const key = m.phaseId ?? '__classroom__';
    let section = byKey.get(key);
    if (!section) {
      const label =
        m.phaseId === null ? 'ทั้งห้องเรียน' : `${m.phaseName ?? 'Phase'}${m.phaseArchived ? ' (เก็บถาวร)' : ''}`;
      section = { key, label, items: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.items.push(m);
  }
  return sections;
}

const ICON_BTN =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-cocoon-blue hover:bg-cocoon-blue-soft';

export function MaterialsTab({
  classroomId,
  materials,
  phases,
}: {
  classroomId: string;
  materials: MaterialItem[];
  /** Active (non-archived) phases in order. */
  phases: MaterialPhaseOption[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<MaterialItem | null>(null);

  // Look the edited material up from props so router.refresh() updates its file list live.
  const editing = editingId ? (materials.find((m) => m.id === editingId) ?? null) : null;
  const sections = groupSections(materials);

  const openCreate = () => {
    setEditingId(null);
    setDialogOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      const result = await deleteMaterial({ materialId: toDelete.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('ลบสื่อการเรียนแล้ว');
      setToDelete(null);
      router.refresh();
    } catch {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const createButton = (
    <button type="button" onClick={openCreate} className={cn(BTN_PRIMARY, 'inline-flex items-center gap-2')}>
      <Plus className="size-4" aria-hidden />
      เพิ่มสื่อการเรียน
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:mb-6">
        <h2 className="text-[18px] leading-normal font-bold text-cocoon-blue lg:text-[20px]">
          สื่อการเรียน ({materials.length})
        </h2>
        {materials.length > 0 && createButton}
      </div>

      {materials.length === 0 ? (
        <div className={EMPTY_CARD}>
          <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีสื่อการเรียน</p>
          <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
            แชร์เอกสาร ลิงก์ หรือไฟล์ให้นักเรียนทุกกลุ่ม โดยไม่ต้องสร้างงานและไม่มีการส่งงาน
          </p>
          {createButton}
        </div>
      ) : (
        <div className="space-y-6 lg:space-y-8">
          {sections.map((section) => (
            <section key={section.key} aria-label={section.label}>
              <h3 className="mb-3 text-[16px] leading-normal font-bold text-cocoon-ink lg:text-[18px]">
                {section.label}
              </h3>
              <ul className="grid gap-3 md:grid-cols-2 lg:gap-4">
                {section.items.map((m) => (
                  <li key={m.id} className={cn(CARD, 'flex flex-col gap-3')}>
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[16px] leading-normal font-bold break-words text-cocoon-ink lg:text-[18px]">
                        {m.title}
                      </p>
                      <button type="button" onClick={() => openEdit(m.id)} aria-label={`แก้ไข ${m.title}`} className={ICON_BTN}>
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(m)}
                        aria-label={`ลบ ${m.title}`}
                        className={cn(ICON_BTN, 'text-[#e8590c] hover:bg-[#fff1e8]')}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    {m.description && (
                      <p className="text-[14px] leading-normal whitespace-pre-line text-cocoon-ink">{m.description}</p>
                    )}
                    {m.linkUrl && (
                      <a
                        href={m.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1.5 text-[14px] font-bold break-all text-cocoon-blue hover:underline"
                      >
                        <ExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {m.linkUrl}
                      </a>
                    )}
                    <MaterialFileButtons files={m.files} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <MaterialDialog
        classroomId={classroomId}
        phases={phases}
        material={editing}
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditingId(null);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(next) => {
          if (!next) setToDelete(null);
        }}
        title="ลบสื่อการเรียนนี้?"
        description={toDelete ? `“${toDelete.title}”` : undefined}
        consequences={
          toDelete
            ? [
                'นักเรียนจะไม่เห็นสื่อการเรียนนี้อีก',
                ...(toDelete.files.length > 0 ? [`ไฟล์ ${toDelete.files.length} ไฟล์จะถูกลบถาวร`] : []),
              ]
            : []
        }
        confirmLabel="ลบ"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
