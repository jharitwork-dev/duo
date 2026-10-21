// Classroom forms (teacher-defined questions, students answer Typeform-style) — pure domain logic
// shared by server actions, queries, route handlers and client UI.
// Framework-free: no DB / React imports.
import { z } from 'zod';
import type { WorkPageDoc, WorkPageNode } from '@/lib/work-page';

// ---------------------------------------------------------------------------------------------
// Constants + types

export const QUESTION_TYPES = ['short_text', 'long_text', 'single_choice', 'multiple_choice', 'rating', 'file'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const FORM_STATUSES = ['draft', 'open', 'closed'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const RESPONSE_MODES = ['individual', 'group'] as const;
export type ResponseMode = (typeof RESPONSE_MODES)[number];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  short_text: 'ข้อความสั้น',
  long_text: 'ข้อความยาว',
  single_choice: 'เลือกหนึ่งข้อ',
  multiple_choice: 'เลือกได้หลายข้อ',
  rating: 'คะแนน',
  file: 'ไฟล์ / ลิงก์',
};

export const FORM_STATUS_LABEL: Record<FormStatus, string> = {
  draft: 'ฉบับร่าง',
  open: 'เปิดรับคำตอบ',
  closed: 'ปิดแล้ว',
};

export const FORM_LIMITS = {
  title: 200,
  description: 2000,
  questionTitle: 300,
  questionDescription: 1000,
  questions: 50,
  minOptions: 2,
  maxOptions: 20,
  optionLabel: 200,
  shortText: 500,
  longText: 5000,
  scaleLabel: 50,
  url: 2000,
};

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface QuestionConfig {
  options?: ChoiceOption[];
  scaleMax?: 5 | 10;
  minLabel?: string;
  maxLabel?: string;
  allowLink?: boolean;
}

export interface FormQuestionDef {
  id: string;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  config: QuestionConfig;
  orderIndex: number;
}

export type FileAnswer =
  | { kind: 'file'; key: string; name: string; size: number; contentType: string }
  | { kind: 'link'; url: string };
export type AnswerValue = string | string[] | number | FileAnswer;
export type FormAnswers = Record<string, AnswerValue>;

type UploadedFile = Extract<FileAnswer, { kind: 'file' }>;

const REQUIRED_ERROR = 'จำเป็นต้องตอบคำถามนี้';
const ERR_LOCKED_BY_RESPONSES = 'มีคำตอบแล้ว';

function isChoiceType(type: QuestionType): type is 'single_choice' | 'multiple_choice' {
  return type === 'single_choice' || type === 'multiple_choice';
}

// ---------------------------------------------------------------------------------------------
// Question config

export function defaultQuestionConfig(type: QuestionType, newId: () => string): QuestionConfig {
  if (isChoiceType(type)) {
    return {
      options: [
        { id: newId(), label: 'ตัวเลือก 1' },
        { id: newId(), label: 'ตัวเลือก 2' },
      ],
    };
  }
  if (type === 'rating') return { scaleMax: 5 };
  if (type === 'file') return { allowLink: true };
  return {};
}

const optionSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(FORM_LIMITS.optionLabel),
});

const choiceConfigSchema = z.object({
  options: z
    .array(optionSchema)
    .min(FORM_LIMITS.minOptions)
    .max(FORM_LIMITS.maxOptions)
    .refine((opts) => new Set(opts.map((o) => o.id)).size === opts.length),
});

const scaleLabel = z.string().trim().max(FORM_LIMITS.scaleLabel).optional();
const ratingConfigSchema = z.object({
  scaleMax: z.union([z.literal(5), z.literal(10)]),
  minLabel: scaleLabel,
  maxLabel: scaleLabel,
});

const fileConfigSchema = z.object({ allowLink: z.boolean().optional() });

export function parseQuestionConfig(
  type: QuestionType,
  raw: unknown,
): { ok: true; config: QuestionConfig } | { ok: false; error: string } {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (isChoiceType(type)) {
    const parsed = choiceConfigSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: `ต้องมีตัวเลือก ${FORM_LIMITS.minOptions}–${FORM_LIMITS.maxOptions} ข้อ และแต่ละข้อต้องมีข้อความ (ไม่เกิน ${FORM_LIMITS.optionLabel} ตัวอักษร)`,
      };
    }
    return { ok: true, config: { options: parsed.data.options.map((o) => ({ id: o.id, label: o.label })) } };
  }
  if (type === 'rating') {
    const parsed = ratingConfigSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'ตั้งค่าคะแนนไม่ถูกต้อง (1–5 หรือ 1–10)' };
    const config: QuestionConfig = { scaleMax: parsed.data.scaleMax };
    if (parsed.data.minLabel) config.minLabel = parsed.data.minLabel;
    if (parsed.data.maxLabel) config.maxLabel = parsed.data.maxLabel;
    return { ok: true, config };
  }
  if (type === 'file') {
    const parsed = fileConfigSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'ตั้งค่าคำถามไฟล์ไม่ถูกต้อง' };
    return { ok: true, config: { allowLink: parsed.data.allowLink ?? true } };
  }
  return { ok: true, config: {} };
}

// ---------------------------------------------------------------------------------------------
// URLs + file keys

/** http(s) only, ≤ FORM_LIMITS.url chars. */
export function isSafeHttpUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > FORM_LIMITS.url) return false;
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildFormFileKey(formId: string, ownerKey: string, uploadId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-]/g, '_').slice(-100);
  return `forms/${formId}/${ownerKey}/${uploadId}-${safeName}`;
}

/** True when the key lives directly under forms/{formId}/{ownerKey}/ and has no path tricks. */
export function isFormFileKeyInScope(key: string, formId: string, ownerKey: string): boolean {
  if (typeof key !== 'string' || !formId || !ownerKey) return false;
  if (key.includes('..') || key.includes('\\')) return false;
  const prefix = `forms/${formId}/${ownerKey}/`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  return rest.length > 0 && !rest.includes('/');
}

// ---------------------------------------------------------------------------------------------
// Answers

export function isAnswerEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    const v = value as { kind?: unknown; url?: unknown; key?: unknown };
    if (v.kind === 'link') return typeof v.url !== 'string' || v.url.trim().length === 0;
    if (v.kind === 'file') return typeof v.key !== 'string' || v.key.length === 0;
    return true;
  }
  return false;
}

const uploadedFileSchema = z.object({
  kind: z.literal('file'),
  key: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  size: z.number().int().min(0),
  contentType: z.string().max(200),
});
const linkSchema = z.object({ kind: z.literal('link'), url: z.string().trim() });

function validateOne(
  question: FormQuestionDef,
  value: unknown,
  ctx: { formId: string; ownerKey: string },
): { ok: true; value: AnswerValue } | { ok: false; error: string } {
  const options = question.config.options ?? [];
  const optionIds = new Set(options.map((o) => o.id));
  switch (question.type) {
    case 'short_text':
    case 'long_text': {
      if (typeof value !== 'string') return { ok: false, error: 'คำตอบไม่ถูกต้อง' };
      const text = value.trim();
      const max = question.type === 'short_text' ? FORM_LIMITS.shortText : FORM_LIMITS.longText;
      if (text.length > max) return { ok: false, error: `ข้อความยาวเกิน ${max} ตัวอักษร` };
      return { ok: true, value: text };
    }
    case 'single_choice': {
      if (typeof value !== 'string' || !optionIds.has(value)) return { ok: false, error: 'กรุณาเลือกตัวเลือกที่มีอยู่' };
      return { ok: true, value };
    }
    case 'multiple_choice': {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && optionIds.has(v))) {
        return { ok: false, error: 'กรุณาเลือกตัวเลือกที่มีอยู่' };
      }
      const unique = [...new Set(value as string[])];
      return { ok: true, value: unique };
    }
    case 'rating': {
      const max = question.config.scaleMax ?? 5;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
        return { ok: false, error: `กรุณาเลือกคะแนน 1–${max}` };
      }
      return { ok: true, value };
    }
    case 'file': {
      const file = uploadedFileSchema.safeParse(value);
      if (file.success) {
        if (!isFormFileKeyInScope(file.data.key, ctx.formId, ctx.ownerKey)) {
          return { ok: false, error: 'ไฟล์ไม่ถูกต้อง' };
        }
        return { ok: true, value: { ...file.data } };
      }
      const link = linkSchema.safeParse(value);
      if (link.success) {
        if (question.config.allowLink === false) return { ok: false, error: 'คำถามนี้รับเฉพาะไฟล์' };
        if (!isSafeHttpUrl(link.data.url)) return { ok: false, error: 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://' };
        return { ok: true, value: { kind: 'link', url: link.data.url } };
      }
      return { ok: false, error: 'คำตอบไม่ถูกต้อง' };
    }
  }
}

/** Validates + normalises raw answers against the question definitions (unknown ids stripped). */
export function validateAnswers(
  questions: FormQuestionDef[],
  raw: unknown,
  ctx: { formId: string; ownerKey: string },
): { ok: true; answers: FormAnswers } | { ok: false; errors: Record<string, string> } {
  const input = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null) as Record<string, unknown> | null;
  if (!input) return { ok: false, errors: { _form: 'คำตอบไม่ถูกต้อง' } };
  const answers: FormAnswers = {};
  const errors: Record<string, string> = {};
  for (const question of questions) {
    const value = Object.prototype.hasOwnProperty.call(input, question.id) ? input[question.id] : undefined;
    if (isAnswerEmpty(value)) {
      if (question.required) errors[question.id] = REQUIRED_ERROR;
      continue;
    }
    const result = validateOne(question, value, ctx);
    if (result.ok) answers[question.id] = result.value;
    else errors[question.id] = result.error;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, answers };
}

// ---------------------------------------------------------------------------------------------
// Status + eligibility

export function effectiveFormStatus(form: { status: FormStatus; closesAt: Date | null }, now: Date): FormStatus {
  if (form.status === 'open' && form.closesAt && form.closesAt.getTime() <= now.getTime()) return 'closed';
  return form.status;
}

export function formOwnerKey(mode: ResponseMode, userId: string, groupId: string | null): string | null {
  if (mode === 'group') return groupId ?? null;
  return userId;
}

export type EligibilityReason = 'ok' | 'not_member' | 'draft' | 'not_in_audience' | 'no_group' | 'closed';

export function decideFormEligibility(input: {
  form: { status: FormStatus; closesAt: Date | null; responseMode: ResponseMode };
  audienceGroupIds: string[];
  isClassroomStudent: boolean;
  userId: string;
  studentGroupId: string | null;
  now: Date;
}): { visible: boolean; canRespond: boolean; reason: EligibilityReason; ownerKey: string | null } {
  const { form, audienceGroupIds, studentGroupId } = input;
  if (!input.isClassroomStudent) return { visible: false, canRespond: false, reason: 'not_member', ownerKey: null };
  if (form.status === 'draft') return { visible: false, canRespond: false, reason: 'draft', ownerKey: null };
  if (audienceGroupIds.length > 0 && (!studentGroupId || !audienceGroupIds.includes(studentGroupId))) {
    return { visible: false, canRespond: false, reason: 'not_in_audience', ownerKey: null };
  }
  const ownerKey = formOwnerKey(form.responseMode, input.userId, studentGroupId);
  if (effectiveFormStatus(form, input.now) === 'closed') {
    return { visible: true, canRespond: false, reason: 'closed', ownerKey };
  }
  if (!ownerKey) return { visible: true, canRespond: false, reason: 'no_group', ownerKey: null };
  return { visible: true, canRespond: true, reason: 'ok', ownerKey };
}

// ---------------------------------------------------------------------------------------------
// Edit guards (Thai error or null)

export function checkQuestionChange(input: {
  hasResponses: boolean;
  before: Pick<FormQuestionDef, 'type' | 'config'>;
  after: { type: QuestionType; config: QuestionConfig };
}): string | null {
  if (!input.hasResponses) return null;
  const { before, after } = input;
  if (before.type !== after.type) return `เปลี่ยนประเภทคำถามไม่ได้ เพราะ${ERR_LOCKED_BY_RESPONSES}`;
  if (isChoiceType(before.type)) {
    const afterIds = new Set((after.config.options ?? []).map((o) => o.id));
    if ((before.config.options ?? []).some((o) => !afterIds.has(o.id))) {
      return `ลบตัวเลือกเดิมไม่ได้ เพราะ${ERR_LOCKED_BY_RESPONSES} (แก้ข้อความหรือเพิ่มตัวเลือกได้)`;
    }
  }
  if (before.type === 'rating' && (before.config.scaleMax ?? 5) !== (after.config.scaleMax ?? 5)) {
    return `เปลี่ยนช่วงคะแนนไม่ได้ เพราะ${ERR_LOCKED_BY_RESPONSES}`;
  }
  return null;
}

export function canDeleteQuestion(hasResponses: boolean): string | null {
  return hasResponses ? `ลบคำถามไม่ได้ เพราะ${ERR_LOCKED_BY_RESPONSES}` : null;
}

export function canChangeResponseMode(input: { hasResponses: boolean; linkedTaskCount: number }): string | null {
  if (input.hasResponses) return `เปลี่ยนรูปแบบการตอบไม่ได้ เพราะ${ERR_LOCKED_BY_RESPONSES}`;
  if (input.linkedTaskCount > 0) return 'เปลี่ยนรูปแบบการตอบไม่ได้ เพราะแบบฟอร์มนี้เป็นงานใน Phase แล้ว';
  return null;
}

export function canPublish(questionCount: number): string | null {
  return questionCount > 0 ? null : 'เพิ่มคำถามอย่างน้อย 1 ข้อก่อนเปิดรับคำตอบ';
}

/** Reopening a form whose deadline already passed clears the deadline. */
export function reopenClosesAt(closesAt: Date | null, now: Date): Date | null {
  if (!closesAt) return null;
  return closesAt.getTime() <= now.getTime() ? null : closesAt;
}

// ---------------------------------------------------------------------------------------------
// Respondents + summary

export function expectedRespondents(input: {
  mode: ResponseMode;
  audienceGroupIds: string[];
  groups: { id: string; memberIds: string[] }[];
  classroomStudentIds: string[];
}): { kind: 'students' | 'groups'; ids: string[] } {
  const audience = new Set(input.audienceGroupIds);
  const targetGroups = audience.size === 0 ? input.groups : input.groups.filter((g) => audience.has(g.id));
  if (input.mode === 'group') return { kind: 'groups', ids: targetGroups.map((g) => g.id) };
  if (audience.size === 0) return { kind: 'students', ids: [...input.classroomStudentIds] };
  const students = new Set(input.classroomStudentIds);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const group of targetGroups) {
    for (const id of group.memberIds) {
      if (students.has(id) && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return { kind: 'students', ids };
}

export interface QuestionSummary {
  questionId: string;
  type: QuestionType;
  answered: number;
  choices?: { optionId: string; label: string; count: number }[];
  rating?: { counts: number[]; average: number | null };
  texts?: string[];
  files?: number;
}

export function summarizeResponses(questions: FormQuestionDef[], answersList: FormAnswers[]): QuestionSummary[] {
  return questions.map((question) => {
    const values = answersList.map((a) => a?.[question.id]).filter((v) => !isAnswerEmpty(v)) as AnswerValue[];
    const summary: QuestionSummary = { questionId: question.id, type: question.type, answered: values.length };
    if (isChoiceType(question.type)) {
      const options = question.config.options ?? [];
      const counts = new Map(options.map((o) => [o.id, 0]));
      for (const value of values) {
        const ids = Array.isArray(value) ? value : [value];
        for (const id of new Set(ids)) {
          if (typeof id === 'string' && counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
      summary.choices = options.map((o) => ({ optionId: o.id, label: o.label, count: counts.get(o.id) ?? 0 }));
    } else if (question.type === 'rating') {
      const max = question.config.scaleMax ?? 5;
      const counts = Array<number>(max).fill(0);
      let total = 0;
      let n = 0;
      for (const value of values) {
        if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max) {
          counts[value - 1] += 1;
          total += value;
          n += 1;
        }
      }
      summary.rating = { counts, average: n > 0 ? Math.round((total / n) * 100) / 100 : null };
    } else if (question.type === 'file') {
      summary.files = values.length;
    } else {
      summary.texts = values.filter((v): v is string => typeof v === 'string');
    }
    return summary;
  });
}

// ---------------------------------------------------------------------------------------------
// Formatting + CSV

export function formatAnswerText(
  question: FormQuestionDef,
  value: AnswerValue | undefined,
  opts?: { fileLink?: (file: UploadedFile) => string },
): string {
  if (isAnswerEmpty(value) || value === undefined) return '';
  const labelOf = (id: string) => question.config.options?.find((o) => o.id === id)?.label ?? '';
  switch (question.type) {
    case 'single_choice':
      return typeof value === 'string' ? labelOf(value) : '';
    case 'multiple_choice':
      return Array.isArray(value) ? value.map(labelOf).filter(Boolean).join(', ') : '';
    case 'rating':
      return typeof value === 'number' ? String(value) : '';
    case 'file': {
      if (typeof value !== 'object' || Array.isArray(value)) return '';
      if (value.kind === 'link') return value.url;
      return opts?.fileLink ? `${value.name} (${opts.fileLink(value)})` : value.name;
    }
    default:
      return typeof value === 'string' ? value : '';
  }
}

/** CSV cell with formula-injection guard (= + - @ TAB CR → prefixed with ') and RFC 4180 quoting. */
export function escapeCsvCell(value: string): string {
  let cell = value ?? '';
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  if (/[",\r\n]/.test(cell)) cell = `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

function bangkokParts(date: Date) {
  const d = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    m: pad(d.getUTCMonth() + 1),
    d: pad(d.getUTCDate()),
    hh: pad(d.getUTCHours()),
    mm: pad(d.getUTCMinutes()),
  };
}

function formatBangkok(date: Date): string {
  const p = bangkokParts(date);
  return `${p.y}-${p.m}-${p.d} ${p.hh}:${p.mm}`;
}

export interface FormCsvRow {
  submittedAt: Date;
  classroomName: string;
  groupName: string;
  respondentName: string;
  email: string;
  answers: FormAnswers;
  fileLink?: (questionId: string, file: UploadedFile) => string;
}

export function buildFormCsv(input: { questions: FormQuestionDef[]; rows: FormCsvRow[] }): string {
  const header = [
    'วันที่ส่ง',
    'ห้องเรียน',
    'กลุ่ม',
    'ผู้ตอบ',
    'อีเมล',
    ...input.questions.map((q, i) => `${i + 1}. ${q.title}`),
  ];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const row of input.rows) {
    const cells = [
      formatBangkok(row.submittedAt),
      row.classroomName,
      row.groupName,
      row.respondentName,
      row.email,
      ...input.questions.map((q) =>
        formatAnswerText(q, row.answers?.[q.id], {
          fileLink: row.fileLink ? (file) => row.fileLink!(q.id, file) : undefined,
        }),
      ),
    ];
    lines.push(cells.map(escapeCsvCell).join(','));
  }
  return `﻿${lines.join('\r\n')}`;
}

/** File names for Content-Disposition: `filename="ascii"; filename*=UTF-8''utf8`. */
export function formCsvFileName(title: string, now: Date): { ascii: string; utf8: string } {
  const p = bangkokParts(now);
  const stamp = `${p.y}${p.m}${p.d}`;
  const asciiTitle = title
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/["/\\;,]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const ascii = `${asciiTitle || 'form'}-responses-${stamp}.csv`;
  const cleanTitle = title.replace(/[\u0000-\u001f"/\\]/g, '_').trim().slice(0, 100) || 'form';
  const utf8 = encodeURIComponent(`${cleanTitle}-${stamp}.csv`);
  return { ascii, utf8 };
}

// ---------------------------------------------------------------------------------------------
// Submission snapshot (form answers → work-page doc stored on the submission row)

function textNode(text: string): WorkPageNode {
  return { type: 'text', text };
}

function multilineParagraph(text: string): WorkPageNode {
  const lines = text.split(/\r?\n/);
  const content: WorkPageNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) content.push({ type: 'hardBreak' });
    if (line.length > 0) content.push(textNode(line));
  });
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
}

export function buildFormSnapshotDoc(input: {
  formTitle: string;
  questions: FormQuestionDef[];
  answers: FormAnswers;
}): WorkPageDoc {
  const content: WorkPageNode[] = [
    { type: 'heading', attrs: { level: 2 }, content: [textNode(input.formTitle.trim() || 'แบบฟอร์ม')] },
  ];
  input.questions.forEach((question, i) => {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [textNode(`${i + 1}. ${question.title.trim() || 'คำถาม'}`)],
    });
    const value = input.answers[question.id];
    if (
      question.type === 'file' &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value.kind === 'link' &&
      isSafeHttpUrl(value.url)
    ) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: value.url, marks: [{ type: 'link', attrs: { href: value.url } }] }],
      });
      return;
    }
    const text = formatAnswerText(question, value);
    content.push(text.trim() ? multilineParagraph(text) : { type: 'paragraph', content: [textNode('—')] });
  });
  return { type: 'doc', content };
}

// ---------------------------------------------------------------------------------------------
// Form-linked phase tasks

export const FORM_TASK_WORK_PAGE_ERROR = 'งานนี้ส่งผ่านแบบฟอร์ม';

/** Form-linked todos are completed through the form only — work-page submit/save/upload is blocked. */
export function formTaskWorkPageBlock(todo: { formId: string | null | undefined }): string | null {
  return todo.formId ? FORM_TASK_WORK_PAGE_ERROR : null;
}

export type BridgeAction =
  | { todoId: string; action: 'insert' }
  | { todoId: string; action: 'update'; submissionId: string }
  | { todoId: string; action: 'skip'; reason: 'phase_locked' | 'approved' };

/**
 * For each todo linked to a form the student just answered: what to do with its submissions row.
 * Locked phase → skip (the form response itself is still saved by the caller); approved → skip;
 * pending → update that submission; none / rejected → insert a new pending submission.
 */
export function planFormSubmissionBridge(
  todos: {
    todoId: string;
    phaseViewable: boolean;
    latestStatus: 'none' | 'pending' | 'approved' | 'rejected';
    latestSubmissionId: string | null;
  }[],
): BridgeAction[] {
  return todos.map((t): BridgeAction => {
    if (!t.phaseViewable) return { todoId: t.todoId, action: 'skip', reason: 'phase_locked' };
    if (t.latestStatus === 'approved') return { todoId: t.todoId, action: 'skip', reason: 'approved' };
    if (t.latestStatus === 'pending' && t.latestSubmissionId) {
      return { todoId: t.todoId, action: 'update', submissionId: t.latestSubmissionId };
    }
    return { todoId: t.todoId, action: 'insert' };
  });
}
