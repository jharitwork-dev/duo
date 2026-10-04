'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { COMMENT_MAX, formatCommentTime, type CommentView } from '@/lib/comment-thread';
import { formatSubmissionDate } from '@/lib/format';
import { MemberAvatar } from '@/components/cocoon/member-identity';
import { OverflowMenu, type OverflowMenuItem } from '@/components/cocoon/overflow-menu';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { BTN_INFO, BTN_TERTIARY } from '@/components/cocoon/ui';
import { CommentBody } from './comment-body';
import { COMMENT_TEXTAREA, isSendShortcut, useAutoGrow } from './comment-composer';

const TAG = 'inline-flex h-[20px] items-center rounded-full px-2 text-[11px] leading-none font-bold whitespace-nowrap';

interface CommentMessageProps {
  comment: CommentView;
  /** ISO "now" used for relative times (server time on first render, then refreshed per poll). */
  now: string;
  onEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}

/** One chat-like message: avatar, name, role badge, time, round tag, body, edit/delete menu. */
export function CommentMessage({ comment, now, onEdit, onDelete }: CommentMessageProps) {
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isTeacher = comment.authorRole === 'teacher';

  const menu: OverflowMenuItem[] = [];
  if (comment.canEdit) {
    menu.push({ label: 'แก้ไข', icon: <Pencil className="size-4" aria-hidden />, onSelect: () => setEditing(true) });
  }
  if (comment.canDelete) {
    menu.push({
      label: 'ลบ',
      destructive: true,
      icon: <Trash2 className="size-4" aria-hidden />,
      onSelect: () => setConfirmOpen(true),
    });
  }

  return (
    <li className="flex items-start gap-3">
      <MemberAvatar name={comment.authorName} imageUrl={comment.authorImageUrl} className="mt-0.5 size-8" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[14px] leading-normal font-bold text-cocoon-ink">{comment.authorName}</span>
          <span
            className={cn(
              TAG,
              isTeacher ? 'bg-cocoon-blue text-white' : 'border border-cocoon-line text-cocoon-subtle',
            )}
          >
            {isTeacher ? 'ครู' : 'นักเรียน'}
          </span>
          <time
            dateTime={comment.createdAt}
            title={formatSubmissionDate(comment.createdAt)}
            className="text-[12px] leading-normal font-medium text-cocoon-muted"
          >
            {formatCommentTime(comment.createdAt, now)}
          </time>
          {comment.round !== null && (
            <span className={cn(TAG, 'bg-cocoon-cream text-cocoon-subtle')}>ส่งครั้งที่ {comment.round}</span>
          )}
          {comment.editedAt && !comment.deleted && (
            <span className="text-[12px] leading-normal font-medium text-cocoon-muted">แก้ไขแล้ว</span>
          )}
          {menu.length > 0 && !editing && (
            <OverflowMenu items={menu} label="ตัวเลือกความคิดเห็น" className="-my-2 ml-auto size-9" />
          )}
        </div>

        <div
          className={cn(
            'mt-1.5 rounded-[12px] px-4 py-3',
            isTeacher ? 'bg-cocoon-blue-soft' : 'border border-[#f1ece5] bg-white',
          )}
        >
          {comment.deleted || comment.body === null ? (
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted italic">ข้อความถูกลบ</p>
          ) : editing ? (
            <EditForm
              initial={comment.body}
              onCancel={() => setEditing(false)}
              onSave={async (body) => {
                const ok = await onEdit(comment.id, body);
                if (ok) setEditing(false);
              }}
            />
          ) : (
            <CommentBody body={comment.body} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="ลบความคิดเห็นนี้?"
        consequences={['ข้อความจะแสดงเป็น “ข้อความถูกลบ” สำหรับทุกคนในเธรดนี้']}
        confirmLabel="ลบ"
        onConfirm={async () => {
          await onDelete(comment.id);
          setConfirmOpen(false);
        }}
      />
    </li>
  );
}

function EditForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const ref = useAutoGrow(text);
  const length = text.trim().length;
  const disabled = busy || length === 0 || length > COMMENT_MAX;

  async function save() {
    if (disabled) return;
    setBusy(true);
    try {
      await onSave(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        autoFocus
        aria-label="แก้ไขความคิดเห็น"
        maxLength={COMMENT_MAX + 200}
        className={cn(COMMENT_TEXTAREA, 'bg-white')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (isSendShortcut(e)) {
            e.preventDefault();
            void save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className={cn(BTN_TERTIARY, 'h-9 px-3 text-[14px]')} onClick={onCancel} disabled={busy}>
          ยกเลิก
        </button>
        <button type="submit" className={cn(BTN_INFO, 'h-9 px-3 text-[14px] disabled:opacity-50')} disabled={disabled}>
          บันทึก
        </button>
      </div>
    </form>
  );
}
