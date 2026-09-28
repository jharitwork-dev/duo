import { Fragment } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { cn } from 'cn';
import { StatusPill } from '@/components/cocoon/status-pill';
import type { SubmissionStatus } from '@/lib/node-path';
import { firstLine, type PathTodo } from './node-path';
import { NodeIcon, NodeRing, ringStatusFor } from './node-icons';

// Geometry measured from design/mac/home.png (1280 frame, 1152 column).
const NODE = 220;
const CONNECTOR = 56;
const GAP = 56; // node edge ↔ connector edge
const PER_LINE = 3;

type Link_ = 'plus' | 'arrow';

interface NodePathDesktopProps {
  rows: PathTodo[][];
  statuses: Record<string, SubmissionStatus>;
  locked: Set<string>;
  currentId: string | null;
}

function Connector({ kind }: { kind: Link_ }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative z-10 flex shrink-0 items-center justify-center rounded-full border bg-cocoon-cream',
        kind === 'plus' ? 'border-cocoon-disabled' : 'border-cocoon-blue',
      )}
      style={{ width: CONNECTOR, height: CONNECTOR }}
    >
      {kind === 'plus' ? (
        <Plus size={28} strokeWidth={3} className="text-cocoon-disabled" />
      ) : (
        <ArrowRight size={28} strokeWidth={3} className="text-cocoon-disabled" />
      )}
    </span>
  );
}

function Node({
  todo,
  status,
  isLocked,
  isCurrent,
}: {
  todo: PathTodo;
  status: SubmissionStatus;
  isLocked: boolean;
  isCurrent: boolean;
}) {
  const subtitle = firstLine(todo.description);
  const ring = ringStatusFor(status, isLocked, isCurrent);

  const body = (
    <>
      <div className="absolute inset-[7px] flex flex-col items-center rounded-full bg-white px-5 pt-[18px] text-center">
        <div className="flex h-[80px] items-end justify-center">
          <NodeIcon status={status} locked={isLocked} size="lg" />
        </div>
        <p className="mt-2 line-clamp-1 w-full text-[16px] leading-normal font-bold tracking-tight text-cocoon-ink">
          {todo.title}
        </p>
        {subtitle && (
          <p className="w-full truncate text-[12px] leading-normal font-medium text-cocoon-muted">{subtitle}</p>
        )}
        <StatusPill
          status={isLocked ? 'locked' : status}
          className="absolute bottom-[18px] h-[24px] px-2.5 text-[14px] font-bold"
        />
      </div>
      {ring && <NodeRing status={ring} diameter={NODE} stroke={ring === 'approved' ? 6 : 5} className="inset-0" />}
    </>
  );

  const nodeClass = 'relative z-10 block shrink-0 rounded-full bg-cocoon-cream shadow-cocoon-node';
  const style = { width: NODE, height: NODE };

  return isLocked ? (
    <div aria-disabled="true" className={nodeClass} style={style}>
      {body}
    </div>
  ) : (
    <Link
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
}

/**
 * Horizontal node path (lg+). Nodes flow left→right, wrapping after 3 per line.
 * "+" joins the parallel pair of one row, "→" joins consecutive rows; a line that
 * continues on the next one ends with a trailing "→".
 */
export function NodePathDesktop({ rows, statuses, locked, currentId }: NodePathDesktopProps) {
  const flat: { todo: PathTodo; link: Link_ | null }[] = [];
  rows.forEach((row, r) =>
    row.forEach((todo, i) => {
      // `link` = connector between this node and the next one.
      const isLastOfRow = i === row.length - 1;
      const hasNext = !(isLastOfRow && r === rows.length - 1);
      flat.push({ todo, link: hasNext ? (isLastOfRow ? 'arrow' : 'plus') : null });
    }),
  );
  if (flat.length === 0) return null;

  const lines: (typeof flat)[] = [];
  for (let i = 0; i < flat.length; i += PER_LINE) lines.push(flat.slice(i, i + PER_LINE));

  return (
    <div className="hidden lg:block max-xl:[zoom:0.85]">
      <div className="mt-[82px] flex flex-col items-center gap-16">
        {lines.map((line, li) => {
          const trailing = line[line.length - 1].link;
          return (
            <div key={li} className="relative flex items-center" style={{ gap: GAP }}>
              {/* Track behind the nodes: first node centre → last node centre (or trailing connector). */}
              <span
                aria-hidden
                className="absolute top-1/2 z-0 h-[6px] -translate-y-1/2 bg-cocoon-track"
                style={{ left: NODE / 2, right: trailing ? -(GAP + CONNECTOR) : NODE / 2 }}
              />
              {line.map(({ todo, link }, i) => (
                <Fragment key={todo.id}>
                  <Node
                    todo={todo}
                    status={statuses[todo.id] ?? 'none'}
                    isLocked={locked.has(todo.id)}
                    isCurrent={todo.id === currentId}
                  />
                  {i < line.length - 1 && link && <Connector kind={link} />}
                </Fragment>
              ))}
              {trailing && (
                <span className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(100% + ${GAP}px)` }}>
                  <Connector kind={trailing} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-[88px] text-[14px] leading-normal font-medium text-cocoon-muted">
        เลือกงานเพื่อดูรายละเอียด ไฟล์ที่ส่ง และผลตรวจล่าสุด
      </p>
    </div>
  );
}
