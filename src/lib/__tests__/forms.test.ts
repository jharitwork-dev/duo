import { describe, it, expect } from 'vitest';
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  FORM_STATUS_LABEL,
  FORM_TASK_WORK_PAGE_ERROR,
  buildFormCsv,
  buildFormFileKey,
  buildFormSnapshotDoc,
  canChangeResponseMode,
  canDeleteQuestion,
  canPublish,
  checkQuestionChange,
  decideFormEligibility,
  defaultQuestionConfig,
  effectiveFormStatus,
  escapeCsvCell,
  expectedRespondents,
  formCsvFileName,
  formOwnerKey,
  formTaskWorkPageBlock,
  formatAnswerText,
  isAnswerEmpty,
  isFormFileKeyInScope,
  isSafeHttpUrl,
  parseQuestionConfig,
  planFormSubmissionBridge,
  reopenClosesAt,
  summarizeResponses,
  validateAnswers,
  type FormQuestionDef,
  type QuestionType,
} from '../forms';
import { validateWorkPageContent, type WorkPageNode } from '../work-page';

const q = (id: string, type: QuestionType, extra: Partial<FormQuestionDef> = {}): FormQuestionDef => ({
  id,
  type,
  title: `Q ${id}`,
  description: null,
  required: false,
  config: {},
  orderIndex: 0,
  ...extra,
});

const OPTS = [
  { id: 'a', label: 'แอปเปิ้ล' },
  { id: 'b', label: 'กล้วย' },
  { id: 'c', label: 'ส้ม' },
];

const ctx = { formId: 'f1', ownerKey: 'u1' };

describe('constants', () => {
  it('labels every question type and status in Thai', () => {
    for (const t of QUESTION_TYPES) expect(QUESTION_TYPE_LABEL[t]).toBeTruthy();
    expect(FORM_STATUS_LABEL).toEqual({ draft: 'ฉบับร่าง', open: 'เปิดรับคำตอบ', closed: 'ปิดแล้ว' });
  });
});

describe('defaultQuestionConfig / parseQuestionConfig', () => {
  let n = 0;
  const newId = () => `id${++n}`;
  it('creates sensible defaults', () => {
    const c = defaultQuestionConfig('single_choice', newId);
    expect(c.options).toHaveLength(2);
    expect(c.options?.map((o) => o.label)).toEqual(['ตัวเลือก 1', 'ตัวเลือก 2']);
    expect(defaultQuestionConfig('rating', newId)).toEqual({ scaleMax: 5 });
    expect(defaultQuestionConfig('file', newId)).toEqual({ allowLink: true });
    expect(defaultQuestionConfig('short_text', newId)).toEqual({});
    for (const t of QUESTION_TYPES) expect(parseQuestionConfig(t, defaultQuestionConfig(t, newId)).ok).toBe(true);
  });
  it('validates choice options', () => {
    expect(parseQuestionConfig('single_choice', { options: [{ id: 'a', label: 'x' }] }).ok).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => ({ id: `o${i}`, label: `L${i}` }));
    expect(parseQuestionConfig('multiple_choice', { options: many }).ok).toBe(false);
    expect(
      parseQuestionConfig('single_choice', {
        options: [
          { id: 'a', label: 'x' },
          { id: 'a', label: 'y' },
        ],
      }).ok,
    ).toBe(false);
    expect(
      parseQuestionConfig('single_choice', {
        options: [
          { id: 'a', label: '   ' },
          { id: 'b', label: 'y' },
        ],
      }).ok,
    ).toBe(false);
    expect(
      parseQuestionConfig('single_choice', {
        options: [
          { id: '', label: 'x' },
          { id: 'b', label: 'y' },
        ],
      }).ok,
    ).toBe(false);
    expect(
      parseQuestionConfig('single_choice', {
        options: [
          { id: 'a', label: 'x'.repeat(201) },
          { id: 'b', label: 'y' },
        ],
      }).ok,
    ).toBe(false);
    const ok = parseQuestionConfig('single_choice', {
      options: [
        { id: 'a', label: '  x  ' },
        { id: 'b', label: 'y' },
      ],
    });
    expect(ok).toEqual({
      ok: true,
      config: {
        options: [
          { id: 'a', label: 'x' },
          { id: 'b', label: 'y' },
        ],
      },
    });
  });
  it('validates rating and file configs', () => {
    expect(parseQuestionConfig('rating', { scaleMax: 7 }).ok).toBe(false);
    expect(parseQuestionConfig('rating', { scaleMax: 10, minLabel: 'น้อย', maxLabel: 'มาก' })).toEqual({
      ok: true,
      config: { scaleMax: 10, minLabel: 'น้อย', maxLabel: 'มาก' },
    });
    expect(parseQuestionConfig('rating', { scaleMax: 5, minLabel: 'x'.repeat(51) }).ok).toBe(false);
    expect(parseQuestionConfig('file', {})).toEqual({ ok: true, config: { allowLink: true } });
    expect(parseQuestionConfig('file', { allowLink: false })).toEqual({ ok: true, config: { allowLink: false } });
    expect(parseQuestionConfig('long_text', { anything: 1 })).toEqual({ ok: true, config: {} });
  });
});

describe('isSafeHttpUrl', () => {
  it('only accepts http(s) up to 2000 chars', () => {
    expect(isSafeHttpUrl('https://example.com/x')).toBe(true);
    expect(isSafeHttpUrl('http://example.com')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,hi')).toBe(false);
    expect(isSafeHttpUrl('not a url')).toBe(false);
    expect(isSafeHttpUrl('https://e.com/' + 'a'.repeat(2000))).toBe(false);
  });
});

describe('form file keys', () => {
  it('builds and scopes keys', () => {
    const key = buildFormFileKey('f1', 'u1', 'up1', 'รายงาน final (1).pdf');
    expect(key.startsWith('forms/f1/u1/up1-')).toBe(true);
    expect(key).not.toMatch(/[\s()]/);
    expect(isFormFileKeyInScope(key, 'f1', 'u1')).toBe(true);
    expect(isFormFileKeyInScope(key, 'f1', 'u2')).toBe(false);
    expect(isFormFileKeyInScope(key, 'f2', 'u1')).toBe(false);
    expect(isFormFileKeyInScope('forms/f1/u1/../u2/x.pdf', 'f1', 'u1')).toBe(false);
  });
});

describe('isAnswerEmpty', () => {
  it('detects empty values', () => {
    expect(isAnswerEmpty(undefined)).toBe(true);
    expect(isAnswerEmpty(null)).toBe(true);
    expect(isAnswerEmpty('  ')).toBe(true);
    expect(isAnswerEmpty([])).toBe(true);
    expect(isAnswerEmpty('x')).toBe(false);
    expect(isAnswerEmpty(3)).toBe(false);
    expect(isAnswerEmpty({ kind: 'link', url: 'https://x.y' })).toBe(false);
  });
});

describe('validateAnswers', () => {
  const questions: FormQuestionDef[] = [
    q('s', 'short_text', { required: true }),
    q('l', 'long_text'),
    q('sc', 'single_choice', { config: { options: OPTS } }),
    q('mc', 'multiple_choice', { config: { options: OPTS }, required: true }),
    q('r', 'rating', { config: { scaleMax: 5 } }),
    q('f', 'file', { config: { allowLink: true } }),
  ];
  const valid = {
    s: '  hello  ',
    mc: ['a', 'b', 'a'],
  };

  it('accepts valid answers, trims, dedupes, strips unknown, omits optional empties', () => {
    const res = validateAnswers(questions, { ...valid, l: '', zzz: 'x' }, ctx);
    expect(res).toEqual({ ok: true, answers: { s: 'hello', mc: ['a', 'b'] } });
  });
  it('requires required questions', () => {
    const res = validateAnswers(questions, { mc: [] }, ctx);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.s).toBe('จำเป็นต้องตอบคำถามนี้');
      expect(res.errors.mc).toBe('จำเป็นต้องตอบคำถามนี้');
    }
  });
  it('enforces text length limits', () => {
    expect(validateAnswers(questions, { ...valid, s: 'x'.repeat(501) }, ctx).ok).toBe(false);
    expect(validateAnswers(questions, { ...valid, l: 'x'.repeat(5001) }, ctx).ok).toBe(false);
    expect(validateAnswers(questions, { ...valid, l: 'x'.repeat(5000) }, ctx).ok).toBe(true);
  });
  it('validates choices', () => {
    expect(validateAnswers(questions, { ...valid, sc: 'zz' }, ctx).ok).toBe(false);
    expect(validateAnswers(questions, { ...valid, sc: 'b' }, ctx)).toMatchObject({ ok: true, answers: { sc: 'b' } });
    expect(validateAnswers(questions, { ...valid, mc: ['a', 'zz'] }, ctx).ok).toBe(false);
    expect(validateAnswers(questions, { ...valid, mc: 'a' }, ctx).ok).toBe(false);
  });
  it('validates ratings', () => {
    expect(validateAnswers(questions, { ...valid, r: 0 }, ctx).ok).toBe(false);
    expect(validateAnswers(questions, { ...valid, r: 6 }, ctx).ok).toBe(false);
    expect(validateAnswers(questions, { ...valid, r: 2.5 }, ctx).ok).toBe(false);
    expect(validateAnswers(questions, { ...valid, r: 5 }, ctx)).toMatchObject({ ok: true, answers: { r: 5 } });
  });
  it('validates file and link answers', () => {
    const key = buildFormFileKey('f1', 'u1', 'up', 'a.pdf');
    const file = { kind: 'file', key, name: 'a.pdf', size: 10, contentType: 'application/pdf' };
    expect(validateAnswers(questions, { ...valid, f: file }, ctx)).toMatchObject({ ok: true, answers: { f: file } });
    expect(validateAnswers(questions, { ...valid, f: { ...file, key: buildFormFileKey('f1', 'u2', 'up', 'a.pdf') } }, ctx).ok).toBe(false);
    expect(validateAnswers(questions, { ...valid, f: { ...file, key: 'forms/f1/u1/../x' } }, ctx).ok).toBe(false);
    expect(validateAnswers(questions, { ...valid, f: { kind: 'link', url: 'https://x.y/z' } }, ctx).ok).toBe(true);
    expect(validateAnswers(questions, { ...valid, f: { kind: 'link', url: 'javascript:alert(1)' } }, ctx).ok).toBe(false);
    const noLink = [q('f', 'file', { config: { allowLink: false } })];
    expect(validateAnswers(noLink, { f: { kind: 'link', url: 'https://x.y' } }, ctx).ok).toBe(false);
  });
  it('rejects non-object payloads', () => {
    expect(validateAnswers(questions, 'nope', ctx).ok).toBe(false);
  });
});

describe('effectiveFormStatus / formOwnerKey / reopenClosesAt', () => {
  const now = new Date('2026-10-21T10:00:00Z');
  const past = new Date('2026-10-21T09:00:00Z');
  const future = new Date('2026-10-22T09:00:00Z');
  it('closes open forms past closesAt', () => {
    expect(effectiveFormStatus({ status: 'open', closesAt: past }, now)).toBe('closed');
    expect(effectiveFormStatus({ status: 'open', closesAt: now }, now)).toBe('closed');
    expect(effectiveFormStatus({ status: 'open', closesAt: future }, now)).toBe('open');
    expect(effectiveFormStatus({ status: 'open', closesAt: null }, now)).toBe('open');
    expect(effectiveFormStatus({ status: 'draft', closesAt: past }, now)).toBe('draft');
    expect(effectiveFormStatus({ status: 'closed', closesAt: future }, now)).toBe('closed');
  });
  it('derives the owner key', () => {
    expect(formOwnerKey('individual', 'u', 'g')).toBe('u');
    expect(formOwnerKey('individual', 'u', null)).toBe('u');
    expect(formOwnerKey('group', 'u', 'g')).toBe('g');
    expect(formOwnerKey('group', 'u', null)).toBeNull();
  });
  it('clears a past deadline on reopen', () => {
    expect(reopenClosesAt(past, now)).toBeNull();
    expect(reopenClosesAt(future, now)).toBe(future);
    expect(reopenClosesAt(null, now)).toBeNull();
  });
});

describe('decideFormEligibility', () => {
  const now = new Date('2026-10-21T10:00:00Z');
  const base = {
    form: { status: 'open' as const, closesAt: null, responseMode: 'individual' as const },
    audienceGroupIds: [] as string[],
    isClassroomStudent: true,
    userId: 'u1',
    studentGroupId: 'g1' as string | null,
    now,
  };
  it('hides from non-members and drafts', () => {
    expect(decideFormEligibility({ ...base, isClassroomStudent: false })).toMatchObject({ visible: false, reason: 'not_member' });
    expect(decideFormEligibility({ ...base, form: { ...base.form, status: 'draft' } })).toMatchObject({
      visible: false,
      reason: 'draft',
    });
  });
  it('enforces restricted audience', () => {
    expect(decideFormEligibility({ ...base, audienceGroupIds: ['g2'] })).toMatchObject({ visible: false, reason: 'not_in_audience' });
    expect(decideFormEligibility({ ...base, audienceGroupIds: ['g2'], studentGroupId: null })).toMatchObject({
      visible: false,
      reason: 'not_in_audience',
    });
    expect(decideFormEligibility({ ...base, audienceGroupIds: ['g1'] })).toMatchObject({ visible: true, canRespond: true });
  });
  it('lets groupless students answer whole-classroom individual forms', () => {
    expect(decideFormEligibility({ ...base, studentGroupId: null })).toEqual({
      visible: true,
      canRespond: true,
      reason: 'ok',
      ownerKey: 'u1',
    });
  });
  it('blocks group mode without a group', () => {
    expect(
      decideFormEligibility({ ...base, studentGroupId: null, form: { ...base.form, responseMode: 'group' } }),
    ).toMatchObject({ visible: true, canRespond: false, reason: 'no_group', ownerKey: null });
    expect(decideFormEligibility({ ...base, form: { ...base.form, responseMode: 'group' } })).toMatchObject({
      canRespond: true,
      ownerKey: 'g1',
    });
  });
  it('closed forms are visible but read-only', () => {
    expect(
      decideFormEligibility({ ...base, form: { ...base.form, closesAt: new Date('2026-10-20T00:00:00Z') } }),
    ).toMatchObject({ visible: true, canRespond: false, reason: 'closed', ownerKey: 'u1' });
    expect(decideFormEligibility({ ...base, form: { ...base.form, status: 'closed' } })).toMatchObject({
      visible: true,
      canRespond: false,
      reason: 'closed',
    });
  });
});

describe('edit guards', () => {
  const before = { type: 'single_choice' as const, config: { options: OPTS } };
  it('blocks destructive changes once responses exist', () => {
    expect(checkQuestionChange({ hasResponses: true, before, after: { type: 'multiple_choice', config: { options: OPTS } } })).toBeTruthy();
    expect(checkQuestionChange({ hasResponses: true, before, after: { type: 'single_choice', config: { options: OPTS.slice(0, 2) } } })).toBeTruthy();
    expect(
      checkQuestionChange({
        hasResponses: true,
        before: { type: 'rating', config: { scaleMax: 5 } },
        after: { type: 'rating', config: { scaleMax: 10 } },
      }),
    ).toBeTruthy();
  });
  it('allows safe changes once responses exist', () => {
    expect(
      checkQuestionChange({
        hasResponses: true,
        before,
        after: { type: 'single_choice', config: { options: [...OPTS.map((o) => ({ ...o, label: o.label + '!' })), { id: 'd', label: 'ใหม่' }] } },
      }),
    ).toBeNull();
    expect(
      checkQuestionChange({
        hasResponses: true,
        before: { type: 'rating', config: { scaleMax: 5 } },
        after: { type: 'rating', config: { scaleMax: 5, minLabel: 'น้อย' } },
      }),
    ).toBeNull();
  });
  it('allows everything without responses', () => {
    expect(checkQuestionChange({ hasResponses: false, before, after: { type: 'rating', config: { scaleMax: 10 } } })).toBeNull();
  });
  it('other guards', () => {
    expect(canDeleteQuestion(true)).toBeTruthy();
    expect(canDeleteQuestion(false)).toBeNull();
    expect(canChangeResponseMode({ hasResponses: true, linkedTaskCount: 0 })).toBeTruthy();
    expect(canChangeResponseMode({ hasResponses: false, linkedTaskCount: 1 })).toBeTruthy();
    expect(canChangeResponseMode({ hasResponses: false, linkedTaskCount: 0 })).toBeNull();
    expect(canPublish(0)).toBeTruthy();
    expect(canPublish(1)).toBeNull();
  });
});

describe('expectedRespondents', () => {
  const groups = [
    { id: 'g1', memberIds: ['u1', 'u2'] },
    { id: 'g2', memberIds: ['u3'] },
  ];
  const classroomStudentIds = ['u1', 'u2', 'u3', 'u4'];
  it('individual whole classroom → all students', () => {
    expect(expectedRespondents({ mode: 'individual', audienceGroupIds: [], groups, classroomStudentIds })).toEqual({
      kind: 'students',
      ids: classroomStudentIds,
    });
  });
  it('individual restricted → audience group members', () => {
    expect(expectedRespondents({ mode: 'individual', audienceGroupIds: ['g1'], groups, classroomStudentIds })).toEqual({
      kind: 'students',
      ids: ['u1', 'u2'],
    });
  });
  it('group mode → groups', () => {
    expect(expectedRespondents({ mode: 'group', audienceGroupIds: [], groups, classroomStudentIds })).toEqual({
      kind: 'groups',
      ids: ['g1', 'g2'],
    });
    expect(expectedRespondents({ mode: 'group', audienceGroupIds: ['g2'], groups, classroomStudentIds })).toEqual({
      kind: 'groups',
      ids: ['g2'],
    });
  });
});

describe('summarizeResponses', () => {
  const questions = [
    q('sc', 'single_choice', { config: { options: OPTS } }),
    q('mc', 'multiple_choice', { config: { options: OPTS } }),
    q('r', 'rating', { config: { scaleMax: 5 } }),
    q('t', 'short_text'),
    q('f', 'file'),
  ];
  it('aggregates per question', () => {
    const s = summarizeResponses(questions, [
      { sc: 'a', mc: ['a', 'b'], r: 4, t: 'hi', f: { kind: 'link', url: 'https://x.y' } },
      { sc: 'zz', mc: ['b'], r: 2, t: 'yo' },
      {},
    ]);
    expect(s[0]).toMatchObject({
      questionId: 'sc',
      answered: 2,
      choices: [
        { optionId: 'a', label: 'แอปเปิ้ล', count: 1 },
        { optionId: 'b', label: 'กล้วย', count: 0 },
        { optionId: 'c', label: 'ส้ม', count: 0 },
      ],
    });
    expect(s[1].choices?.map((c) => c.count)).toEqual([1, 2, 0]);
    expect(s[2]).toMatchObject({ answered: 2, rating: { counts: [0, 1, 0, 1, 0], average: 3 } });
    expect(s[3]).toMatchObject({ answered: 2, texts: ['hi', 'yo'] });
    expect(s[4]).toMatchObject({ answered: 1, files: 1 });
  });
  it('rating average null with no answers', () => {
    expect(summarizeResponses([q('r', 'rating', { config: { scaleMax: 10 } })], [])[0].rating).toEqual({
      counts: Array(10).fill(0),
      average: null,
    });
  });
});

describe('CSV', () => {
  it('escapes cells', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvCell('+1')).toBe("'+1");
    expect(escapeCsvCell('-1')).toBe("'-1");
    expect(escapeCsvCell('@x')).toBe("'@x");
    expect(escapeCsvCell('\tx')).toBe("'\tx");
    expect(escapeCsvCell('\rx')).toBe('"\'\rx"');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
  });
  it('builds a BOM-prefixed CRLF CSV', () => {
    const questions = [
      q('mc', 'multiple_choice', { title: 'ผลไม้', config: { options: OPTS } }),
      q('r', 'rating', { title: 'คะแนน', config: { scaleMax: 5 } }),
      q('f', 'file', { title: 'ไฟล์' }),
      q('l', 'file', { title: 'ลิงก์' }),
    ];
    const csv = buildFormCsv({
      questions,
      rows: [
        {
          submittedAt: new Date('2026-10-21T03:05:00Z'),
          classroomName: 'ห้อง A',
          groupName: 'กลุ่ม 1',
          respondentName: 'สมชาย',
          email: 's@x.y',
          answers: {
            mc: ['a', 'c'],
            r: 4,
            f: { kind: 'file', key: 'k', name: 'a.pdf', size: 1, contentType: 'application/pdf' },
            l: { kind: 'link', url: 'https://x.y' },
          },
          fileLink: (qid, file) => `https://dl/${qid}/${file.key}`,
        },
      ],
    });
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('วันที่ส่ง,ห้องเรียน,กลุ่ม,ผู้ตอบ,อีเมล,1. ผลไม้,2. คะแนน,3. ไฟล์,4. ลิงก์');
    expect(lines[1]).toBe('2026-10-21 10:05,ห้อง A,กลุ่ม 1,สมชาย,s@x.y,"แอปเปิ้ล, ส้ม",4,a.pdf (https://dl/f/k),https://x.y');
  });
  it('builds export file names', () => {
    const n = formCsvFileName('แบบสอบถาม 1/2', new Date('2026-10-21T03:05:00Z'));
    expect(n.ascii).toMatch(/^[\x20-\x7e]+\.csv$/);
    expect(n.ascii).not.toMatch(/["/\\]/);
    expect(n.utf8).toContain(encodeURIComponent('แบบสอบถาม'));
  });
});

describe('formatAnswerText', () => {
  it('formats values', () => {
    const sc = q('sc', 'single_choice', { config: { options: OPTS } });
    expect(formatAnswerText(sc, 'b')).toBe('กล้วย');
    expect(formatAnswerText(sc, undefined)).toBe('');
    expect(formatAnswerText(q('f', 'file'), { kind: 'file', key: 'k', name: 'a.pdf', size: 1, contentType: 'x' })).toBe('a.pdf');
  });
});

describe('formTaskWorkPageBlock', () => {
  it('blocks form-linked todos', () => {
    expect(formTaskWorkPageBlock({ formId: null })).toBeNull();
    expect(formTaskWorkPageBlock({ formId: undefined })).toBeNull();
    expect(formTaskWorkPageBlock({ formId: 'f1' })).toBe(FORM_TASK_WORK_PAGE_ERROR);
    expect(FORM_TASK_WORK_PAGE_ERROR).toBe('งานนี้ส่งผ่านแบบฟอร์ม');
  });
});

describe('planFormSubmissionBridge', () => {
  it('plans per todo', () => {
    expect(
      planFormSubmissionBridge([
        { todoId: 't1', phaseViewable: false, latestStatus: 'none', latestSubmissionId: null },
        { todoId: 't2', phaseViewable: true, latestStatus: 'none', latestSubmissionId: null },
        { todoId: 't3', phaseViewable: true, latestStatus: 'rejected', latestSubmissionId: 's3' },
        { todoId: 't4', phaseViewable: true, latestStatus: 'pending', latestSubmissionId: 's4' },
        { todoId: 't5', phaseViewable: true, latestStatus: 'approved', latestSubmissionId: 's5' },
      ]),
    ).toEqual([
      { todoId: 't1', action: 'skip', reason: 'phase_locked' },
      { todoId: 't2', action: 'insert' },
      { todoId: 't3', action: 'insert' },
      { todoId: 't4', action: 'update', submissionId: 's4' },
      { todoId: 't5', action: 'skip', reason: 'approved' },
    ]);
  });
});

describe('buildFormSnapshotDoc', () => {
  const texts = (n: WorkPageNode): string[] => [
    ...(n.text ? [n.text] : []),
    ...(n.content ?? []).flatMap(texts),
  ];
  it('produces a valid work-page doc with titles and answers', () => {
    const questions = [
      q('a', 'short_text', { title: 'ชื่อโปรเจกต์' }),
      q('b', 'multiple_choice', { title: 'ผลไม้', config: { options: OPTS } }),
      q('c', 'file', { title: 'ไฟล์งาน' }),
      q('d', 'long_text', { title: 'ไม่ได้ตอบ' }),
      q('e', 'file', { title: 'ลิงก์' }),
    ];
    const doc = buildFormSnapshotDoc({
      formTitle: 'แบบฟอร์มทดสอบ',
      questions,
      answers: {
        a: 'Duo',
        b: ['a', 'b'],
        c: { kind: 'file', key: 'forms/f1/u1/x-a.pdf', name: 'a.pdf', size: 1, contentType: 'application/pdf' },
        e: { kind: 'link', url: 'https://x.y/z' },
      },
    });
    expect(validateWorkPageContent(doc).ok).toBe(true);
    const all = texts(doc).join('\n');
    expect(all).toContain('แบบฟอร์มทดสอบ');
    expect(all).toContain('ชื่อโปรเจกต์');
    expect(all).toContain('Duo');
    expect(all).toContain('แอปเปิ้ล, กล้วย');
    expect(all).toContain('a.pdf');
    expect(all).not.toContain('forms/f1/u1');
    expect(all).toContain('—');
    expect(all).toContain('https://x.y/z');
  });
});
