// Deadline helpers (quick task 261004-03i). All inputs are UTC instants; display is Asia/Bangkok.
// Run under TZ=UTC and TZ=America/New_York: results must be identical.
import { describe, it, expect } from 'vitest';
import {
  DEADLINE_STATUS_LABEL,
  DEFAULT_DEADLINE_TIME,
  DUE_SOON_MS,
  LATENESS_HELP,
  bangkokInputToUtc,
  formatDeadline,
  formatDeadlineDate,
  formatDeadlineRelative,
  formatDeadlineShort,
  formatLateness,
  getDeadlineStatus,
  getEffectiveDeadline,
  utcToBangkokInput,
} from '../deadline';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// 18 ต.ค. 23.59 Bangkok
const D = new Date('2026-10-18T16:59:00Z');
const at = (offsetMs: number) => new Date(D.getTime() + offsetMs);

describe('getEffectiveDeadline', () => {
  const X = new Date('2026-10-20T10:00:00Z');
  it('falls back to the phase deadline', () => {
    expect(getEffectiveDeadline({ deadline: null }, { deadline: X })?.toISOString()).toBe(X.toISOString());
  });
  it('the to-do deadline wins over the phase', () => {
    expect(getEffectiveDeadline({ deadline: D }, { deadline: X })?.toISOString()).toBe(D.toISOString());
  });
  it('null when neither has one (or no phase)', () => {
    expect(getEffectiveDeadline({ deadline: null }, { deadline: null })).toBeNull();
    expect(getEffectiveDeadline({ deadline: null }, null)).toBeNull();
  });
  it('accepts serialized ISO strings', () => {
    expect(getEffectiveDeadline({ deadline: null }, { deadline: X.toISOString() })?.getTime()).toBe(X.getTime());
    expect(getEffectiveDeadline({ deadline: D.toISOString() }, null)?.getTime()).toBe(D.getTime());
  });
});

describe('getDeadlineStatus', () => {
  it('none without a deadline', () => {
    expect(getDeadlineStatus({ deadline: null, firstSubmittedAt: null, latestStatus: 'none', now: D })).toEqual({ status: 'none' });
    expect(getDeadlineStatus({ deadline: null, firstSubmittedAt: D, latestStatus: 'pending', now: D }).status).toBe('none');
  });

  it.each<[string, number, string]>([
    ['49 h before', -49 * HOUR, 'upcoming'],
    ['exactly 48 h before', -DUE_SOON_MS, 'due_soon'],
    ['1 min before', -MIN, 'due_soon'],
    ['exactly at the deadline', 0, 'due_soon'],
    ['1 ms after', 1, 'overdue'],
    ['3 days after', 3 * DAY, 'overdue'],
  ])('not submitted, %s → %s', (_label, offset, expected) => {
    expect(getDeadlineStatus({ deadline: D, firstSubmittedAt: null, latestStatus: 'none', now: at(offset) }).status).toBe(expected);
  });

  it('reports remaining / overdue time', () => {
    expect(getDeadlineStatus({ deadline: D, firstSubmittedAt: null, latestStatus: 'none', now: at(-5 * HOUR) })).toEqual({
      status: 'due_soon',
      remainingMs: 5 * HOUR,
    });
    expect(getDeadlineStatus({ deadline: D, firstSubmittedAt: null, latestStatus: 'none', now: at(1) })).toEqual({
      status: 'overdue',
      overdueMs: 1,
    });
  });

  it('first submission exactly at the deadline is on time', () => {
    expect(getDeadlineStatus({ deadline: D, firstSubmittedAt: D, latestStatus: 'pending', now: at(DAY) })).toEqual({ status: 'on_time' });
  });

  it('first submission 1 min late → late with lateMs', () => {
    expect(getDeadlineStatus({ deadline: D, firstSubmittedAt: at(MIN), latestStatus: 'pending', now: at(DAY) })).toEqual({
      status: 'late',
      lateMs: MIN,
    });
  });

  it('a rejected resubmission never turns on_time into late', () => {
    expect(
      getDeadlineStatus({ deadline: D, firstSubmittedAt: at(-DAY), latestStatus: 'rejected', now: at(3 * DAY) }).status,
    ).toBe('on_time');
  });

  it('rejected + late first submission → late, never overdue once submitted', () => {
    expect(
      getDeadlineStatus({ deadline: D, firstSubmittedAt: at(2 * HOUR), latestStatus: 'rejected', now: at(5 * DAY) }),
    ).toEqual({ status: 'late', lateMs: 2 * HOUR });
  });

  it('accepts ISO strings', () => {
    expect(
      getDeadlineStatus({ deadline: D.toISOString(), firstSubmittedAt: at(MIN).toISOString(), latestStatus: 'pending', now: at(DAY) }).status,
    ).toBe('late');
  });
});

describe('formatting (Asia/Bangkok)', () => {
  it('formatDeadline', () => {
    expect(formatDeadline(D)).toBe('ส่งภายใน 18 ต.ค. 23.59');
    expect(formatDeadline(D.toISOString())).toBe('ส่งภายใน 18 ต.ค. 23.59');
  });

  it('formatDeadlineDate / formatDeadlineShort', () => {
    expect(formatDeadlineDate(D)).toBe('18 ต.ค.');
    expect(formatDeadlineShort(D)).toBe('ส่งภายใน 18 ต.ค.');
  });

  it('rolls over at Bangkok midnight, not UTC midnight', () => {
    expect(formatDeadlineDate(new Date('2026-10-18T17:30:00Z'))).toBe('19 ต.ค.');
    expect(formatDeadline(new Date('2026-10-18T17:30:00Z'))).toBe('ส่งภายใน 19 ต.ค. 00.30');
  });

  it.each<[number, string]>([
    [2 * DAY + 3 * HOUR, 'อีก 2 วัน'],
    [DAY, 'อีก 1 วัน'],
    [5 * HOUR + 59 * MIN, 'เหลือ 5 ชม.'],
    [30 * MIN, 'เหลือ 30 นาที'],
    [10 * 1000, 'เหลือ 1 นาที'],
    [-(DAY + HOUR), 'เลยกำหนด 1 วัน'],
    [-3 * HOUR, 'เลยกำหนด 3 ชม.'],
    [-10 * MIN, 'เลยกำหนด 10 นาที'],
    [-1, 'เลยกำหนด 1 นาที'],
  ])('formatDeadlineRelative with %i ms left → %s', (left, expected) => {
    expect(formatDeadlineRelative(D, at(-left))).toBe(expected);
  });

  it.each<[number, string]>([
    [2 * DAY + 5 * HOUR, 'ช้า 2 วัน'],
    [3 * HOUR + 10 * MIN, 'ช้า 3 ชม.'],
    [5 * MIN, 'ช้า 5 นาที'],
    [1, 'ช้า 1 นาที'],
  ])('formatLateness(%i) → %s', (ms, expected) => {
    expect(formatLateness(ms)).toBe(expected);
  });

  it('labels and help text', () => {
    expect(DEADLINE_STATUS_LABEL).toEqual({ overdue: 'เลยกำหนด', due_soon: 'ใกล้ถึงกำหนด', on_time: 'ส่งตรงเวลา', late: 'ส่งช้า' });
    expect(LATENESS_HELP).toContain('ส่งครั้งแรก');
    expect(DEFAULT_DEADLINE_TIME).toBe('23:59');
  });
});

describe('Bangkok date/time input conversion', () => {
  it('bangkokInputToUtc', () => {
    expect(bangkokInputToUtc('2026-10-18', '23:59')?.toISOString()).toBe('2026-10-18T16:59:00.000Z');
    expect(bangkokInputToUtc('2026-10-19', '00:30')?.toISOString()).toBe('2026-10-18T17:30:00.000Z');
    expect(bangkokInputToUtc('2026-01-01', '00:00')?.toISOString()).toBe('2025-12-31T17:00:00.000Z');
  });

  it.each([
    ['', '23:59'],
    ['2026-10-18', ''],
    ['2026-13-01', '10:00'],
    ['2026-02-30', '10:00'],
    ['2026-10-18', '24:00'],
    ['2026-10-18', '10:60'],
    ['18/10/2026', '10:00'],
    ['2026-10-18', '9:5'],
  ])('invalid (%s, %s) → null', (date, time) => {
    expect(bangkokInputToUtc(date, time)).toBeNull();
  });

  it('utcToBangkokInput', () => {
    expect(utcToBangkokInput(new Date('2026-10-18T17:30:00Z'))).toEqual({ date: '2026-10-19', time: '00:30' });
    expect(utcToBangkokInput(D)).toEqual({ date: '2026-10-18', time: '23:59' });
    expect(utcToBangkokInput(D.toISOString())).toEqual({ date: '2026-10-18', time: '23:59' });
  });

  it.each(['2026-10-18T16:59:00Z', '2026-10-18T17:00:00Z', '2026-12-31T23:15:00Z', '2027-02-28T17:00:00Z'])(
    'round-trips %s',
    (iso) => {
      const { date, time } = utcToBangkokInput(new Date(iso));
      expect(bangkokInputToUtc(date, time)?.getTime()).toBe(new Date(iso).getTime());
    },
  );
});
