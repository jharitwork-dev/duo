import { cn } from 'cn';
import { getCurrentUserId } from '@/lib/auth';
import type { CommentThreadData } from '@/lib/comment-thread';
import { getCommentThread } from '@/server/queries/comment';
import { CARD, CARD_TITLE } from '@/components/cocoon/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentThread } from './comment-thread';

/**
 * Server-rendered entry point for the to-do discussion thread. Wrap in <Suspense fallback={<CommentThreadSkeleton />}>
 * so the rest of the to-do page does not wait for the thread. Load failures become the thread's error state.
 */
export async function CommentThreadSection({
  todoId,
  groupId,
  studentId,
  viewer,
}: {
  todoId: string;
  groupId?: string;
  studentId?: string;
  viewer: 'student' | 'teacher';
}) {
  let initial: CommentThreadData | null = null;
  let initialError: string | undefined;
  try {
    const userId = await getCurrentUserId();
    initial = await getCommentThread(todoId, userId, { groupId, studentId });
  } catch {
    initialError = 'โหลดความคิดเห็นไม่สำเร็จ';
  }

  return (
    <CommentThread
      // Remount when the teacher switches student so state, polling and the draft reset per thread.
      key={`${todoId}:${groupId ?? ''}:${studentId ?? ''}`}
      todoId={todoId}
      groupId={groupId}
      studentId={studentId}
      initial={initial}
      initialError={initialError}
      viewerIsStudent={viewer === 'student'}
    />
  );
}

/** Loading state for the thread card (Suspense fallback). */
export function CommentThreadSkeleton() {
  return (
    <section className={CARD} aria-busy="true" aria-label="กำลังโหลดความคิดเห็น">
      <h2 className={cn(CARD_TITLE)}>ความคิดเห็น</h2>
      <div className="mt-4 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className={cn('h-12', i === 1 ? 'w-2/3' : 'w-full')} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
