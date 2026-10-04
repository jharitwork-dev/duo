// Static guard: every teacher mutation authorizes against the classroom (not role alone).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ACTIONS_DIR = path.resolve(__dirname, '../actions');
const SCANNED = ['classroom.ts', 'group.ts', 'phase.ts', 'todo.ts', 'template.ts', 'impact.ts'];
const EDITOR_CHECK = /assert(Classroom|Group|Phase|Todo)Editor\(/;
const GROUP_DELETE_CHECK = /authorizeGroupDelete\(/;
// Template-owner checks / creation of a brand-new classroom (no classroom to check yet).
const ALLOWLIST = new Set(['createClassroom', 'deleteTemplate', 'updateTemplate']);

type ExportedFn = { file: string; name: string; body: string };

function exportedFunctions(file: string): ExportedFn[] {
  const source = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
  const re = /export async function (\w+)\s*\(/g;
  const starts: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) starts.push({ name: m[1], index: m.index });
  return starts.map((s, i) => ({
    file,
    name: s.name,
    body: source.slice(s.index, i + 1 < starts.length ? starts[i + 1].index : source.length),
  }));
}

const all = SCANNED.flatMap(exportedFunctions);

describe('authorization coverage of teacher server actions', () => {
  it('scans every listed action file', () => {
    for (const file of SCANNED) {
      expect(all.some((f) => f.file === file), `${file} has no exported actions`).toBe(true);
    }
  });

  it.each(all.filter((f) => f.body.includes('requireRole(ROLES.TEACHER')).map((f) => [`${f.file}:${f.name}`, f]))(
    '%s checks the classroom editor',
    (_label, fn) => {
      const f = fn as ExportedFn;
      if (ALLOWLIST.has(f.name)) return;
      expect(EDITOR_CHECK.test(f.body), `${f.file}:${f.name} must call assert*Editor`).toBe(true);
    },
  );

  it('every impact.ts export authorizes (editor check or group-delete rule)', () => {
    for (const f of all.filter((x) => x.file === 'impact.ts')) {
      expect(EDITOR_CHECK.test(f.body) || GROUP_DELETE_CHECK.test(f.body), `impact.ts:${f.name}`).toBe(true);
    }
  });

  it('deleteGroup branches on the group-delete rule instead of a blanket teacher role check', () => {
    const fn = all.find((f) => f.file === 'group.ts' && f.name === 'deleteGroup');
    expect(fn).toBeDefined();
    expect(GROUP_DELETE_CHECK.test(fn!.body)).toBe(true);
    expect(fn!.body.includes('requireRole(ROLES.TEACHER')).toBe(false);
  });

  it('getAttachmentDownloadUrl and getSubmissionFileUrl gate on the to-do viewer rule', () => {
    const attachment = all.find((f) => f.file === 'todo.ts' && f.name === 'getAttachmentDownloadUrl');
    expect(attachment).toBeDefined();
    expect(attachment!.body).toMatch(/authorizeTodoViewer\(/);
    const submissionFile = exportedFunctions('submission.ts').find((f) => f.name === 'getSubmissionFileUrl');
    expect(submissionFile).toBeDefined();
    expect(submissionFile!.body).toMatch(/authorizeTodoViewer\(/);
  });

  it('no action uses an inline classroom-owner check', () => {
    for (const file of fs.readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts'))) {
      const source = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
      expect(source.includes('eq(classrooms.createdBy'), file).toBe(false);
    }
  });
});

describe('authorization coverage of work page actions (261004-01i)', () => {
  const WORK_PAGE_CHECK = /resolveWorkPageAccess\(|authorizeTodoViewer\(/;
  const fns = exportedFunctions('work-page.ts');

  it('exports the expected actions', () => {
    expect(fns.map((f) => f.name).sort()).toEqual(
      [
        'attachWorkPageFile',
        'createWorkPageUploadUrl',
        'getWorkPageFileUrl',
        'removeWorkPageFile',
        'saveWorkPage',
        'submitWorkPage',
        'updateSubmittedWorkPage',
      ].sort(),
    );
  });

  it('updateSubmittedWorkPage locks page + submission rows, guards on pending, never touches createdAt (261004-03i)', () => {
    const update = fns.find((f) => f.name === 'updateSubmittedWorkPage')!;
    const body = update.body.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).toMatch(/requireRole\(ROLES\.STUDENT\)/);
    expect(body).toMatch(/db\.transaction\(/);
    expect(body).toMatch(/findPage\([^)]*lock: true/);
    expect(body).toMatch(/latestScopedSubmission\([^)]*lock: true/);
    expect(body).toMatch(/eq\(submissions\.status, 'pending'\)/);
    expect(body).toMatch(/updatedAt: now/);
    expect(body).not.toMatch(/createdAt:/);
    expect(body).toMatch(/deadline: access\.deadline/);
    // R2 cleanup only after the transaction and only for unreferenced keys.
    expect(body.indexOf('cleanupR2Objects(')).toBeGreaterThan(body.lastIndexOf('computeOrphanFileKeys('));
  });

  it('edit gates pass the effective deadline (261004-03i)', () => {
    const source = fs.readFileSync(path.join(ACTIONS_DIR, 'work-page.ts'), 'utf8');
    expect(source).toMatch(/deadline: access\.deadline/);
    for (const name of ['saveWorkPage', 'attachWorkPageFile', 'removeWorkPageFile']) {
      expect(fns.find((f) => f.name === name)!.body, name).toMatch(/editBlockMessage\(access/);
    }
  });

  it.each(fns.map((f) => [f.name, f]))('%s authorizes the work page / to-do viewer', (_name, fn) => {
    const f = fn as ExportedFn;
    expect(WORK_PAGE_CHECK.test(f.body), `work-page.ts:${f.name}`).toBe(true);
  });

  it('submitWorkPage locks the page row (FOR UPDATE) inside its transaction', () => {
    const submit = fns.find((f) => f.name === 'submitWorkPage')!;
    expect(submit.body).toMatch(/db\.transaction\(/);
    expect(submit.body).toMatch(/lock: true/);
  });
});

describe('authorization coverage of comment thread actions (261004-fgj)', () => {
  const fns = exportedFunctions('comment.ts');
  // Strip comments so a mention in a comment cannot satisfy the checks.
  const code = (body: string) => body.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  it('exports exactly the five comment actions', () => {
    expect(fns.map((f) => f.name).sort()).toEqual(
      ['deleteComment', 'editComment', 'listComments', 'markCommentsSeen', 'postComment'].sort(),
    );
  });

  it.each(fns.map((f) => [f.name, f]))('%s resolves the caller, then authorizes the thread', (_name, fn) => {
    const body = code((fn as ExportedFn).body);
    expect(body).toMatch(/getCurrentUserId\(\)/);
    expect(body).toMatch(/resolveCommentThread\(/);
    expect(body.indexOf('getCurrentUserId()')).toBeLessThan(body.indexOf('resolveCommentThread('));
  });

  it('postComment writes inside a transaction', () => {
    const post = fns.find((f) => f.name === 'postComment')!;
    expect(post.body).toMatch(/db\.transaction\(/);
  });

  it('comment permissions do not depend on work page locks, submission status or deadlines (261004-03i)', () => {
    const sources = [
      fs.readFileSync(path.join(ACTIONS_DIR, 'comment.ts'), 'utf8'),
      fs.readFileSync(path.resolve(__dirname, '../comment-access.ts'), 'utf8'),
    ];
    for (const src of sources) expect(code(src)).not.toMatch(/canEditWorkPage|latestStatus|latestScopedStatus|deadline/i);
  });
});
