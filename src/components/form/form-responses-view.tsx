// Teacher responses view (quick task 261021-r1c). Server component — no 'use client'.
import { cn } from 'cn';
import { CARD, CARD_META, CARD_TITLE, EMPTY_CARD } from '@/components/cocoon/ui';
import { formatSubmissionDate } from '@/lib/format';
import {
  QUESTION_TYPE_LABEL,
  formatAnswerText,
  isSafeHttpUrl,
  type AnswerValue,
  type FormQuestionDef,
  type QuestionSummary,
} from '@/lib/forms';
import { formFileAnswerPath, type FormResponsesView as ViewData } from '@/server/queries/form';

const TEXT_PREVIEW = 20;

export function FormResponsesView({ data }: { data: ViewData }) {
  const { questions, rows, summary, notAnswered, counts } = data;
  const unit = data.form.responseMode === 'group' ? 'กลุ่ม' : 'คน';
  const summaryById = new Map(summary.map((s) => [s.questionId, s]));

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className={cn(CARD, 'flex flex-wrap items-baseline gap-x-6 gap-y-2')}>
        <p className="text-[16px] font-bold text-cocoon-ink">
          ตอบแล้ว{' '}
          <span className="font-latin text-[24px] text-cocoon-blue">
            {counts.answered}/{counts.expected}
          </span>{' '}
          {unit}
        </p>
        <p className={CARD_META}>คำตอบที่แสดง {rows.length} รายการ</p>
      </div>

      {rows.length === 0 ? (
        <div className={EMPTY_CARD}>
          <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีคำตอบ</p>
          <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
            {data.form.status === 'draft'
              ? 'แบบฟอร์มยังเป็นฉบับร่าง — เผยแพร่เพื่อให้นักเรียนตอบได้'
              : 'คำตอบของนักเรียนจะแสดงที่นี่'}
          </p>
        </div>
      ) : (
        <>
          <section aria-label="สรุปคำตอบ" className="grid gap-4 lg:grid-cols-2">
            {questions.map((q, i) => {
              const s = summaryById.get(q.id);
              return s ? <SummaryCard key={q.id} index={i} question={q} summary={s} /> : null;
            })}
          </section>

          <section aria-label="ตารางคำตอบ" id="responses-table" className={cn(CARD, 'p-0 lg:p-0')}>
            <h2 className={cn(CARD_TITLE, 'px-5 pt-5 lg:px-7 lg:pt-7')}>คำตอบทั้งหมด ({rows.length})</h2>
            <div className="mt-4 overflow-x-auto pb-2">
              <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
                <thead>
                  <tr className="border-y border-[#f1ece5] bg-[#fffaf3] text-cocoon-muted">
                    <th className="px-4 py-2 font-bold whitespace-nowrap">วันที่ส่ง</th>
                    <th className="px-4 py-2 font-bold whitespace-nowrap">กลุ่ม</th>
                    <th className="px-4 py-2 font-bold whitespace-nowrap">ผู้ตอบ</th>
                    {questions.map((q, i) => (
                      <th key={q.id} className="max-w-[240px] min-w-[160px] px-4 py-2 font-bold">
                        {i + 1}. {q.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[#f1ece5] align-top last:border-b-0">
                      <td className="px-4 py-3 whitespace-nowrap text-cocoon-muted">{formatSubmissionDate(r.submittedAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.groupName || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="block font-bold text-cocoon-ink">{r.respondentName}</span>
                        {r.email && <span className="block text-[12px] text-cocoon-muted">{r.email}</span>}
                      </td>
                      {questions.map((q) => (
                        <td key={q.id} className="max-w-[240px] px-4 py-3 break-words whitespace-pre-wrap">
                          <AnswerCell
                            question={q}
                            value={r.answers[q.id]}
                            fileHref={formFileAnswerPath(data.classroom.id, data.form.id, r.id, q.id)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section aria-label="ยังไม่ตอบ" className={CARD}>
        <h2 className={CARD_TITLE}>
          ยังไม่ตอบ ({notAnswered.items.length} {notAnswered.kind === 'groups' ? 'กลุ่ม' : 'คน'})
        </h2>
        {notAnswered.items.length === 0 ? (
          <p className={cn(CARD_META, 'mt-2')}>ตอบครบแล้ว</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {notAnswered.items.map((item) => (
              <li
                key={item.id}
                className="rounded-full border border-[#f1ece5] bg-[#fffaf3] px-3 py-1 text-[14px] font-medium text-cocoon-ink"
              >
                {item.name}
                {item.groupName && <span className="text-cocoon-muted"> · {item.groupName}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AnswerCell({ question, value, fileHref }: { question: FormQuestionDef; value: AnswerValue | undefined; fileHref: string }) {
  if (question.type === 'file' && value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.kind === 'file') {
      return (
        <a href={fileHref} className="font-bold text-cocoon-blue underline-offset-2 hover:underline">
          {value.name}
        </a>
      );
    }
    if (value.kind === 'link') {
      return isSafeHttpUrl(value.url) ? (
        <a
          href={value.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold break-all text-cocoon-blue underline-offset-2 hover:underline"
        >
          {value.url}
        </a>
      ) : (
        <span className="break-all">{value.url}</span>
      );
    }
  }
  const text = formatAnswerText(question, value);
  return text ? <>{text}</> : <span className="text-cocoon-muted">—</span>;
}

function SummaryCard({ index, question, summary }: { index: number; question: FormQuestionDef; summary: QuestionSummary }) {
  return (
    <article className={cn(CARD, 'space-y-3')}>
      <div>
        <p className="text-[12px] font-bold text-cocoon-blue">
          ข้อ {index + 1} · {QUESTION_TYPE_LABEL[question.type]}
        </p>
        <h3 className="text-[16px] leading-normal font-bold break-words text-cocoon-ink">{question.title}</h3>
        <p className={CARD_META}>ตอบ {summary.answered} รายการ</p>
      </div>

      {summary.choices && (
        <ul className="space-y-2">
          {summary.choices.map((c) => {
            const pct = summary.answered > 0 ? Math.round((c.count / summary.answered) * 100) : 0;
            return (
              <li key={c.optionId} className="space-y-1">
                <div className="flex justify-between gap-3 text-[14px]">
                  <span className="min-w-0 break-words text-cocoon-ink">{c.label}</span>
                  <span className="shrink-0 font-bold text-cocoon-blue">
                    {c.count} ({pct}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-cocoon-blue-soft">
                  <div className="h-full rounded-full bg-cocoon-blue" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {summary.rating && (
        <div className="space-y-2">
          <p className="text-[14px] font-medium text-cocoon-ink">
            ค่าเฉลี่ย{' '}
            <span className="font-latin text-[20px] font-bold text-cocoon-blue">
              {summary.rating.average ?? '—'}
            </span>{' '}
            / {summary.rating.counts.length}
          </p>
          <div className="flex items-end gap-1" aria-label="การกระจายคะแนน">
            {summary.rating.counts.map((n, i) => {
              const peak = Math.max(1, ...summary.rating!.counts);
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] font-bold text-cocoon-muted">{n}</span>
                  <div className="flex h-16 w-full items-end rounded-[6px] bg-cocoon-blue-soft">
                    <div className="w-full rounded-[6px] bg-cocoon-blue" style={{ height: `${(n / peak) * 100}%` }} />
                  </div>
                  <span className="font-latin text-[12px] font-bold text-cocoon-ink">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.texts && (
        <>
          {summary.texts.length === 0 ? (
            <p className={CARD_META}>—</p>
          ) : (
            <ul className="max-h-[320px] space-y-2 overflow-y-auto">
              {summary.texts.slice(0, TEXT_PREVIEW).map((t, i) => (
                <li
                  key={i}
                  className="rounded-[12px] bg-[#fffaf3] px-3 py-2 text-[14px] break-words whitespace-pre-wrap text-cocoon-ink"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}
          {summary.texts.length > TEXT_PREVIEW && (
            <a href="#responses-table" className="text-[14px] font-bold text-cocoon-blue hover:underline">
              ดูทั้งหมดในตาราง
            </a>
          )}
        </>
      )}

      {summary.files !== undefined && (
        <p className="text-[14px] font-medium text-cocoon-ink">
          แนบไฟล์ / ลิงก์ <span className="font-bold text-cocoon-blue">{summary.files}</span> รายการ
        </p>
      )}
    </article>
  );
}
