// Authorized download of a file answer (quick task 261021-r1c): 302 to a short-lived presigned R2 URL.
// ?response={responseId}&question={questionId}. Self-authorizes like the export route; the key must
// sit inside the response's own forms/{formId}/{ownerKey}/ prefix.
import { and, eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { formResponses } from '@/db/schema/forms';
import { getCurrentRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { isFormFileKeyInScope } from '@/lib/forms';
import { getR2Config, presignGet } from '@/lib/r2';
import { loadClassroomAccess } from '@/server/phase-helpers';
import { loadFormRow } from '@/server/queries/form';

// Valid here: next.config.ts does not enable cacheComponents.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function notFound() {
  return new Response('Not found', { status: 404, headers: NO_STORE });
}

export async function GET(
  request: Request,
  ctx: RouteContext<'/teacher/classroom/[classroomId]/forms/[formId]/file'>,
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
  const responseId = url.searchParams.get('response');
  const questionId = url.searchParams.get('question');
  if (!responseId || !questionId) return notFound();

  const [response] = await db
    .select({ ownerKey: formResponses.ownerKey, answers: formResponses.answers })
    .from(formResponses)
    .where(and(eq(formResponses.id, responseId), eq(formResponses.formId, formId)))
    .limit(1);
  if (!response) return notFound();

  const answer = response.answers?.[questionId];
  if (
    !answer ||
    typeof answer !== 'object' ||
    Array.isArray(answer) ||
    answer.kind !== 'file' ||
    !isFormFileKeyInScope(answer.key, formId, response.ownerKey)
  ) {
    return notFound();
  }

  if (!getR2Config()) return new Response('File storage is not configured', { status: 503, headers: NO_STORE });

  const signed = await presignGet(answer.key, 300, `attachment; filename="${encodeURIComponent(answer.name)}"`);
  return new Response(null, { status: 302, headers: { ...NO_STORE, Location: signed } });
}
