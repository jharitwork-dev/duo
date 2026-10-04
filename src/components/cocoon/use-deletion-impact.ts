'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getDeletionImpact, type DeletionImpact } from '@/server/actions/impact';

type ImpactKind = 'group' | 'phase' | 'todo' | 'todoAllCopies' | 'classroom';

/** Fetches deletion counts while a confirm dialog is open; null while loading. */
export function useDeletionImpact(kind: ImpactKind, id: string, open: boolean) {
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${kind}:${id}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getDeletionImpact({ kind, id })
      .then((result) => {
        if (cancelled) return;
        setImpact(result);
        setLoadedKey(key);
      })
      .catch(() => {
        if (!cancelled) toast.error('โหลดข้อมูลสิ่งที่จะถูกลบไม่สำเร็จ');
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind, id, key]);

  // Stale results from a previous open (or another target) count as "loading".
  return open && loadedKey === key ? impact : null;
}
