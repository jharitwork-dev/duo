import {
  DEADLINE_STATUS_LABEL,
  formatDeadlineRelative,
  formatDeadlineShort,
  formatLateness,
  getDeadlineStatus,
  getEffectiveDeadline,
} from './deadline';
import type { SubmissionStatus } from './node-path';

export type NodeDeadlineTone = 'muted' | 'red' | 'yellow' | 'green' | 'orange';

export interface NodeDeadline {
  label: string;
  tone: NodeDeadlineTone;
  overdue: boolean;
}

type DateInput = Date | string | null;

/**
 * One-line deadline text per node on the student path (261004-03i). To-dos without an effective
 * deadline get no entry. Pure: `now` is passed in.
 */
export function buildNodeDeadlines(
  todos: { id: string; deadline: DateInput }[],
  phase: { deadline: DateInput } | null,
  summaries: Record<string, { status: SubmissionStatus; firstSubmittedAt: DateInput }>,
  now: Date,
): Record<string, NodeDeadline> {
  const out: Record<string, NodeDeadline> = {};
  for (const todo of todos) {
    const deadline = getEffectiveDeadline(todo, phase);
    if (!deadline) continue;
    const summary = summaries[todo.id];
    const result = getDeadlineStatus({
      deadline,
      firstSubmittedAt: summary?.firstSubmittedAt ?? null,
      latestStatus: summary?.status,
      now,
    });
    switch (result.status) {
      case 'upcoming':
        out[todo.id] = { label: formatDeadlineShort(deadline), tone: 'muted', overdue: false };
        break;
      case 'due_soon':
        out[todo.id] = { label: formatDeadlineRelative(deadline, now), tone: 'yellow', overdue: false };
        break;
      case 'overdue':
        out[todo.id] = { label: formatDeadlineRelative(deadline, now), tone: 'red', overdue: true };
        break;
      case 'on_time':
        out[todo.id] = { label: DEADLINE_STATUS_LABEL.on_time, tone: 'green', overdue: false };
        break;
      case 'late':
        out[todo.id] = { label: formatLateness(result.lateMs ?? 0), tone: 'orange', overdue: false };
        break;
      default:
        break;
    }
  }
  return out;
}

export const NODE_DEADLINE_TONE_CLASS: Record<NodeDeadlineTone, string> = {
  muted: 'text-cocoon-muted',
  red: 'text-[#d11a0f]',
  yellow: 'text-[#a86a00]',
  green: 'text-cocoon-green',
  orange: 'text-cocoon-orange',
};
