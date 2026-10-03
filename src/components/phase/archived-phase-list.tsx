'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from 'cn';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { CARD } from '@/components/cocoon/ui';
import { restorePhase } from '@/server/actions/phase';

/** Collapsible list of archived classroom phases with a restore button each. */
export function ArchivedPhaseList({ phases }: { phases: { id: string; name: string }[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (phases.length === 0) return null;

  const handleRestore = (phaseId: string) => {
    setPendingId(phaseId);
    startTransition(async () => {
      try {
        await restorePhase({ phaseId });
        toast.success('กู้คืน Phase แล้ว');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'กู้คืนไม่สำเร็จ');
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn(CARD, 'p-0 lg:p-0')}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-4 text-left text-[15px] font-bold text-cocoon-muted outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 lg:px-6">
        Phase ที่เก็บไว้ ({phases.length})
        <ChevronDown className={cn('ml-auto size-5 transition-transform', isOpen && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y divide-[#f1ece5] border-t border-[#f1ece5]">
          {phases.map((phase) => (
            <li key={phase.id} className="flex items-center gap-3 px-4 py-3 lg:px-6">
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-cocoon-ink">{phase.name}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={pendingId !== null}
                onClick={() => handleRestore(phase.id)}
                className="text-cocoon-blue hover:bg-cocoon-blue-soft"
              >
                <RotateCcw className="mr-1 size-4" />
                {pendingId === phase.id ? 'กำลังกู้คืน...' : 'กู้คืน'}
              </Button>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
