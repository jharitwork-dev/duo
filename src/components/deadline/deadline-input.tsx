'use client';

import { useState } from 'react';
import { cn } from 'cn';
import { INPUT, LABEL } from '@/components/cocoon/ui';
import {
  DEFAULT_DEADLINE_TIME,
  bangkokInputToUtc,
  formatDeadline,
  utcToBangkokInput,
} from '@/lib/deadline';

interface DeadlineInputProps {
  value: Date | null;
  onChange: (deadline: Date | null) => void;
  /** Phase deadline shown as a hint when this value is empty (to-do forms). */
  inheritedDeadline?: Date | string | null;
  idPrefix: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}

function toParts(value: Date | null): { date: string; time: string } {
  return value ? utcToBangkokInput(value) : { date: '', time: '' };
}

/**
 * Date + time deadline picker in Asia/Bangkok (261004-03i). Converts ONLY through
 * bangkokInputToUtc / utcToBangkokInput, so a teacher whose browser is in another time zone
 * still sets Bangkok deadlines. Picking a date defaults the time to 23:59. Clearable.
 */
export function DeadlineInput({
  value,
  onChange,
  inheritedDeadline,
  idPrefix,
  disabled,
  label = 'กำหนดส่ง',
  className,
}: DeadlineInputProps) {
  const valueKey = value ? value.getTime() : null;
  const [prevKey, setPrevKey] = useState<number | null>(valueKey);
  const [parts, setParts] = useState(() => toParts(value));

  // Re-sync when the value changes from outside (e.g. after router.refresh()).
  if (prevKey !== valueKey) {
    setPrevKey(valueKey);
    const next = toParts(value);
    if (next.date !== parts.date || next.time !== parts.time) setParts(next);
  }

  const commit = (date: string, time: string) => {
    const instant = bangkokInputToUtc(date, time);
    if (!instant) return;
    if (value && value.getTime() === instant.getTime()) return;
    setPrevKey(instant.getTime());
    onChange(instant);
  };

  const handleDate = (date: string) => {
    if (!date) {
      setParts({ date: '', time: '' });
      if (value) {
        setPrevKey(null);
        onChange(null);
      }
      return;
    }
    const time = parts.time || DEFAULT_DEADLINE_TIME;
    setParts({ date, time });
    commit(date, time);
  };

  const handleTime = (time: string) => {
    setParts((p) => ({ ...p, time }));
    if (parts.date && time) commit(parts.date, time);
  };

  const clear = () => {
    setParts({ date: '', time: '' });
    setPrevKey(null);
    if (value) onChange(null);
  };

  const inherited = inheritedDeadline ? new Date(inheritedDeadline) : null;
  const hasValue = parts.date !== '';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={LABEL}>{label}</span>
        {hasValue && (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="rounded-full px-2 py-0.5 text-[13px] font-bold text-cocoon-blue hover:bg-cocoon-blue-soft disabled:opacity-50"
          >
            ล้างกำหนดส่ง
          </button>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="min-w-0 space-y-1">
          <span className="block text-[12px] font-medium text-cocoon-muted">วันที่</span>
          <input
            id={`${idPrefix}-date`}
            type="date"
            className={cn(INPUT, 'w-full min-w-0 border outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40')}
            value={parts.date}
            disabled={disabled}
            onChange={(e) => handleDate(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[12px] font-medium text-cocoon-muted">เวลา</span>
          <input
            id={`${idPrefix}-time`}
            type="time"
            className={cn(INPUT, 'w-[120px] border outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40')}
            value={parts.time}
            disabled={disabled || !parts.date}
            onChange={(e) => handleTime(e.target.value)}
          />
        </label>
      </div>
      <p className="text-[12px] font-medium text-cocoon-muted">
        {hasValue
          ? 'เวลาประเทศไทย (GMT+7)'
          : inherited
            ? `ใช้กำหนดส่งของ Phase: ${formatDeadline(inherited)}`
            : 'ไม่มีกำหนดส่ง'}
      </p>
    </div>
  );
}
