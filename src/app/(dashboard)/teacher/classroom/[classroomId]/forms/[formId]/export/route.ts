// CSV export of a classroom form's responses (quick task 261021-r1c).
// URL deliberately has NO file extension: src/middleware.ts skips Clerk for *.csv paths.
// Self-authorizes (signed-in teacher/superadmin + classroom editor) regardless of middleware;
// every failure is a 404 so form ids cannot be probed.
import { auth } from '@clerk/nextjs/server';
import { getCurrentRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { loadClassroomAccess } from '@/server/phase-helpers';
import { buildFormCsvForRequest, loadFormRow } from '@/server/queries/form';

// Valid here: next.config.ts does not enable cacheComponents.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function notFound() {
  return new Response('Not found', { status: 404, headers: NO_STORE });
}

export async function GET(
  request: Request,
  ctx: RouteContext<'/teacher/classroom/[classroomId]/forms/[formId]/export'>,
) {
  const { classroomId, formId } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return notFound();
  const role = await getCurrentRole();
  if (role !== ROLES.TEACHER && role !== ROLES.SUPERADMIN) return notFound();

  const form = await loadFormRow(formId);
  if (!form || form.classroomId !== classroomId) return notFound();
  const { classroom, allowed } = await loadClassroomAccess(classroomId, userId);
  if (!classroom || !allowed) return notFound();

  const url = new URL(request.url);
  const result = await buildFormCsvForRequest(
    formId,
    userId,
    { groupId: url.searchParams.get('group'), mine: url.searchParams.get('mine') === '1' },
    url.origin,
  );
  if (!result) return notFound();

  const { ascii, utf8 } = result.fileName;
  return new Response(result.csv, {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
