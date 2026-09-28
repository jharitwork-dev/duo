/* eslint-disable @next/next/no-img-element -- static Figma assets */
import Link from 'next/link';
import { cn } from 'cn';
import { StatusPill } from '@/components/cocoon/status-pill';
import type { SubmissionStatus } from '@/lib/node-path';
import { NodeIcon, NodeRing, ringStatusFor } from './node-icons';

// Geometry from Figma (402px frame, 336px content box).
const BOX_W = 336;
const NODE_W = 152;
const NODE_H = 149;
const ROW_GAP = 115;
const PITCH = NODE_H + ROW_GAP; // 264
const LINE = 6;
const JUNCTION = 56;

export interface PathTodo {
  id: string;
  title: string;
  description: string | null;
}

interface NodePathProps {
  rows: PathTodo[][];
  statuses: Record<string, SubmissionStatus>;
  locked: Set<string>;
  currentId: string | null;
}

function nodeLefts(count: number): number[] {
  return count === 1 ? [(BOX_W - NODE_W) / 2] : [0, BOX_W - NODE_W];
}

export function firstLine(text: string | null): string {
  return (text ?? '').split(/\r?\n/)[0]?.trim() ?? '';
}

type Rect = { left: number; top: number; width: number; height: number };

function buildConnectors(rows: PathTodo[][]) {
  const lines: Rect[] = [];
  const junctions: { x: number; y: number }[] = [];

  for (let r = 0; r < rows.length - 1; r++) {
    const topA = r * PITCH;
    const topB = (r + 1) * PITCH;
    const centresA = nodeLefts(rows[r].length).map((l) => l + NODE_W / 2);
    const centresB = nodeLefts(rows[r + 1].length).map((l) => l + NODE_W / 2);
    const cyA = topA + NODE_H / 2;
    const cyB = topB + NODE_H / 2;
    const jy = topA + NODE_H + ROW_GAP / 2 + 10;

    for (const x of centresA) {
      lines.push({ left: x - LINE / 2, top: cyA, width: LINE, height: jy - cyA });
    }
    const all = [...centresA, ...centresB];
    const minX = Math.min(...all);
    const maxX = Math.max(...all);
    if (maxX > minX) {
      lines.push({ left: minX - LINE / 2, top: jy - LINE / 2, width: maxX - minX + LINE, height: LINE });
    }
    for (const x of centresB) {
      lines.push({ left: x - LINE / 2, top: jy, width: LINE, height: cyB - jy });
    }
    junctions.push({ x: BOX_W / 2, y: jy });
  }

  return { lines, junctions };
}

export function NodePath({ rows, statuses, locked, currentId }: NodePathProps) {
  if (rows.length === 0) return null;
  const height = rows.length * PITCH - ROW_GAP;
  const { lines, junctions } = buildConnectors(rows);

  return (
    <div className="relative mx-auto mt-6 lg:hidden" style={{ width: BOX_W, height }}>
      {/* Connectors behind nodes */}
      {lines.map((l, i) => (
        <div
          key={`l${i}`}
          aria-hidden
          className="absolute z-0 bg-cocoon-track"
          style={{ left: l.left, top: l.top, width: l.width, height: l.height }}
        />
      ))}
      {junctions.map((j, i) => (
        <div
          key={`j${i}`}
          aria-hidden
          className="absolute z-0 flex items-center justify-center rounded-full border border-cocoon-blue bg-cocoon-cream"
          style={{ left: j.x - JUNCTION / 2, top: j.y - JUNCTION / 2, width: JUNCTION, height: JUNCTION }}
        >
          <span className="text-[32px] leading-none font-bold text-cocoon-disabled">↓</span>
        </div>
      ))}

      {rows.map((row, r) => {
        const lefts = nodeLefts(row.length);
        return row.map((todo, i) => {
          const isLocked = locked.has(todo.id);
          const isCurrent = todo.id === currentId;
          const status = statuses[todo.id] ?? 'none';
          const subtitle = firstLine(todo.description);
          const ring = ringStatusFor(status, isLocked, isCurrent);

          const body = (
            <>
              <div className="absolute top-[4px] left-[5px] flex h-[141px] w-[142px] flex-col items-center justify-center rounded-full bg-white px-1.5 text-center">
                <NodeIcon status={status} locked={isLocked} />
                <p
                  className={cn(
                    'mt-1 line-clamp-1 w-full text-[14px] leading-normal font-bold tracking-tight',
                    isCurrent ? 'text-black' : 'text-cocoon-ink',
                  )}
                >
                  {todo.title}
                </p>
                {subtitle && (
                  <p className="w-full truncate text-[12px] leading-normal font-medium text-cocoon-muted">
                    {subtitle}
                  </p>
                )}
                <StatusPill status={isLocked ? 'locked' : status} className="mt-1" />
              </div>
              {ring && ring !== 'none' && (
                <NodeRing status={ring} diameter={148} stroke={4} className="top-[2px] left-[2px]" />
              )}
              {ring === 'none' && (
                <img
                  src="/figma/c7ea2.svg"
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute top-[2px] left-[76px] h-[84.5px] w-[73.7px] max-w-none"
                />
              )}
            </>
          );

          const nodeClass =
            'absolute z-10 block rounded-full bg-cocoon-cream shadow-cocoon-node';
          const style = { left: lefts[i], top: r * PITCH, width: NODE_W, height: NODE_H };

          return isLocked ? (
            <div key={todo.id} aria-disabled="true" className={nodeClass} style={style}>
              {body}
            </div>
          ) : (
            <Link
              key={todo.id}
              href={`/todo/${todo.id}`}
              aria-label={todo.title}
              className={cn(
                nodeClass,
                'transition-transform outline-none hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-cocoon-blue/50',
              )}
              style={style}
            >
              {body}
            </Link>
          );
        });
      })}
    </div>
  );
}
