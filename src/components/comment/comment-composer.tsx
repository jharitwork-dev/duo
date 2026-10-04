'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { cn } from 'cn';
import { COMMENT_MAX } from '@/lib/comment-thread';
import { BTN_INFO, TEXTAREA } from '@/components/cocoon/ui';

const COUNTER_FROM = 1800;
const MAX_HEIGHT_PX = 216; // about 8 lines

/** Grows a textarea with its content up to MAX_HEIGHT_PX, then scrolls. */
export function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [value]);
  return ref;
}

export const COMMENT_TEXTAREA = cn(
  TEXTAREA,
  'block min-h-[52px] w-full resize-none border leading-normal text-cocoon-ink outline-none placeholder:text-cocoon-muted focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 disabled:opacity-60',
);

/** True for Cmd+Enter (macOS) / Ctrl+Enter, ignoring IME composition. */
export function isSendShortcut(e: React.KeyboardEvent) {
  return e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing;
}

/**
 * Composer: Enter adds a newline, Cmd/Ctrl+Enter or "ส่ง" sends. The draft is kept when sending fails
 * (`onSubmit` resolves false); the parent shows the error toast.
 */
export function CommentComposer({ onSubmit }: { onSubmit: (body: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useId();
  const ref = useAutoGrow(text);
  const length = text.trim().length;
  const tooLong = length > COMMENT_MAX;
  const disabled = busy || length === 0 || tooLong;

  async function send() {
    if (disabled) return;
    setBusy(true);
    try {
      const ok = await onSubmit(text);
      if (ok) setText('');
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label htmlFor={id} className="sr-only">
        เขียนความคิดเห็น
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={1}
        value={text}
        maxLength={COMMENT_MAX + 200}
        placeholder="เขียนความคิดเห็น…"
        className={COMMENT_TEXTAREA}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (isSendShortcut(e)) {
            e.preventDefault();
            void send();
          }
        }}
        aria-describedby={`${id}-hint`}
      />
      <div className="flex items-center justify-between gap-3">
        <p id={`${id}-hint`} className="text-[12px] leading-normal font-medium text-cocoon-muted">
          <span className="hidden sm:inline">กด ⌘/Ctrl + Enter เพื่อส่ง</span>
          {length > COUNTER_FROM && (
            <span className={cn('sm:ml-2', tooLong && 'font-bold text-[#e8590c]')} aria-live="polite">
              {length}/{COMMENT_MAX}
            </span>
          )}
        </p>
        <button
          type="submit"
          disabled={disabled}
          className={cn(BTN_INFO, 'inline-flex h-10 shrink-0 items-center gap-2 px-4 text-[14px] disabled:opacity-50')}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          ส่ง
        </button>
      </div>
    </form>
  );
}
