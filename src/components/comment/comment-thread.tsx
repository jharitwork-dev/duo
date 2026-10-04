'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { COMMENT_POLL_MS, type CommentThreadData } from '@/lib/comment-thread';
import { deleteComment, editComment, listComments, markCommentsSeen, postComment } from '@/server/actions/comment';
import { BTN_TERTIARY, CARD, CARD_TITLE } from '@/components/cocoon/ui';
import { CommentComposer } from './comment-composer';
import { CommentMessage } from './comment-message';

const ERR_LOAD = 'โหลดความคิดเห็นไม่สำเร็จ';
const ERR_POST = 'ส่งความคิดเห็นไม่สำเร็จ ลองอีกครั้ง';
const ERR_GENERIC = 'ทำรายการไม่สำเร็จ ลองอีกครั้ง';

export interface CommentThreadProps {
  todoId: string;
  /** Teachers: the thread's group (group to-do). */
  groupId?: string;
  /** Teachers: the thread's student (individual to-do). */
  studentId?: string;
  initial: CommentThreadData | null;
  initialError?: string;
  viewerIsStudent: boolean;
}

type ThreadState = CommentThreadData;

function stripSuccess<T extends { success: true }>(result: T): Omit<T, 'success'> {
  const { success: _success, ...rest } = result;
  void _success;
  return rest;
}

/**
 * The to-do discussion thread card. Refreshes itself by polling listComments every COMMENT_POLL_MS
 * while the tab is visible (and when it becomes visible again). Deliberately no full page re-render:
 * that would re-render the autosaving work page editor on the same screen.
 */
export function CommentThread({ todoId, groupId, studentId, initial, initialError, viewerIsStudent }: CommentThreadProps) {
  const [data, setData] = useState<ThreadState | null>(initial);
  const [error, setError] = useState<string | null>(initial ? null : (initialError ?? ERR_LOAD));
  const [retrying, setRetrying] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const latestIdRef = useRef<string | null>(initial?.comments.at(-1)?.id ?? null);

  const markSeen = useCallback(() => {
    if (!viewerIsStudent || document.visibilityState !== 'visible') return;
    markCommentsSeen({ todoId, groupId, studentId }).catch(() => {});
  }, [viewerIsStudent, todoId, groupId, studentId]);

  /** Applies a response unless a newer request already landed. Returns true when new comments arrived. */
  const apply = useCallback((seq: number, next: ThreadState): boolean => {
    if (seq < appliedSeqRef.current) return false;
    appliedSeqRef.current = seq;
    const newestId = next.comments.at(-1)?.id ?? null;
    const arrived = newestId !== null && newestId !== latestIdRef.current;
    latestIdRef.current = newestId;
    setData(next);
    setError(null);
    return arrived;
  }, []);

  const refresh = useCallback(
    async ({ silent }: { silent: boolean }) => {
      const seq = ++seqRef.current;
      try {
        const result = await listComments({ todoId, groupId, studentId });
        if (!result.success) {
          if (!silent) setError(result.error);
          return;
        }
        if (apply(seq, stripSuccess(result))) markSeen();
      } catch {
        // Background polls fail quietly; the next tick retries.
        if (!silent) setError(ERR_LOAD);
      }
    },
    [todoId, groupId, studentId, apply, markSeen],
  );

  // Seen on open (the unread dot on the node path clears).
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  // Visible-only polling.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') void refresh({ silent: true });
      }, COMMENT_POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh({ silent: true });
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  async function retry() {
    setRetrying(true);
    try {
      await refresh({ silent: false });
    } finally {
      setRetrying(false);
    }
  }

  async function handlePost(body: string): Promise<boolean> {
    const seq = ++seqRef.current;
    try {
      const result = await postComment({ todoId, groupId, studentId, body });
      if (!result.success) {
        toast.error(result.error);
        return false;
      }
      apply(seq, stripSuccess(result));
      markSeen();
      requestAnimationFrame(() => listEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
      return true;
    } catch {
      toast.error(ERR_POST);
      return false;
    }
  }

  async function handleEdit(commentId: string, body: string): Promise<boolean> {
    const seq = ++seqRef.current;
    try {
      const result = await editComment({ commentId, body });
      if (!result.success) {
        toast.error(result.error);
        return false;
      }
      apply(seq, stripSuccess(result));
      return true;
    } catch {
      toast.error(ERR_GENERIC);
      return false;
    }
  }

  async function handleDelete(commentId: string): Promise<void> {
    const seq = ++seqRef.current;
    try {
      const result = await deleteComment({ commentId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      apply(seq, stripSuccess(result));
    } catch {
      toast.error(ERR_GENERIC);
    }
  }

  const count = data?.count ?? 0;
  const comments = data?.comments ?? [];

  return (
    <section id="comments" aria-labelledby="comments-title" className={cn(CARD, 'scroll-mt-24')}>
      <h2 id="comments-title" className={cn(CARD_TITLE, 'flex items-center gap-2')}>
        <MessageCircle className="size-5" aria-hidden />
        ความคิดเห็น ({count})
      </h2>

      {data === null ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-[12px] bg-[#fff1e8] px-4 py-3" role="alert">
          <p className="text-[14px] leading-normal font-bold text-[#e8590c]">{error ?? ERR_LOAD}</p>
          <button
            type="button"
            className={cn(BTN_TERTIARY, 'inline-flex h-9 items-center gap-2 px-3 text-[14px]')}
            onClick={() => void retry()}
            disabled={retrying}
          >
            <RotateCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden />
            ลองอีกครั้ง
          </button>
        </div>
      ) : (
        <>
          {comments.length === 0 ? (
            <p className="mt-3 text-[14px] leading-normal font-medium text-cocoon-muted">
              {viewerIsStudent
                ? 'ยังไม่มีความคิดเห็น เริ่มคุยกับครูหรือเพื่อนในกลุ่มได้เลย'
                : 'ยังไม่มีความคิดเห็น เริ่มคุยกับนักเรียนได้เลย'}
            </p>
          ) : (
            <ul className="mt-4 space-y-4" aria-live="polite" aria-relevant="additions text">
              {comments.map((comment) => (
                <CommentMessage
                  key={comment.id}
                  comment={comment}
                  now={data.nowIso}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
          <div ref={listEndRef} />
          <div className="mt-4 border-t border-[#f1ece5] pt-4">
            <CommentComposer onSubmit={handlePost} />
          </div>
        </>
      )}
    </section>
  );
}
