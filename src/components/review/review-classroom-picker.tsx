'use client';

import { useRouter } from 'next/navigation';
import { SELECT } from '@/components/cocoon/ui';
import { reviewListHref } from '@/lib/review';

// Classroom picker on /teacher/review (shown only when the teacher has more than one classroom).
export function ReviewClassroomPicker({
  classrooms,
  classroomId,
}: {
  classrooms: { id: string; name: string }[];
  classroomId: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-[14px] font-bold text-cocoon-ink">
      <span className="shrink-0">ห้องเรียน</span>
      <select
        className={`${SELECT} w-full max-w-[320px]`}
        value={classroomId}
        onChange={(e) => router.push(reviewListHref({ classroom: e.target.value }))}
      >
        {classrooms.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
