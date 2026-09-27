'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import {
  registrationSchema,
  EDUCATION_LEVELS,
  EDU_EN,
  type RegistrationInput,
} from '@/register/schema';
import { submitRegistration } from '@/register/submit-registration';

type FormValues = z.input<typeof registrationSchema>;

const INPUT_CLASS =
  'min-h-[48px] w-full rounded-xl border border-[#1A1A1A]/15 bg-white px-4 text-base text-[#1A1A1A] focus:border-[#0269A7] focus:outline-none';

const SELECT_CLASS =
  'min-h-[48px] w-full rounded-xl border border-[#1A1A1A]/15 bg-white px-4 text-base text-[#1A1A1A] focus:border-[#0269A7] focus:outline-none appearance-none';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  const [th, ...rest] = message.split(' / ');
  const en = rest.join(' / ');
  return (
    <p role="alert" className="text-sm text-[#F04A24]">
      <span>{th}</span>
      {en && (
        <span
          style={{ fontFamily: 'var(--font-heading), sans-serif' }}
          className="text-xs"
        >
          {' '}
          / {en}
        </span>
      )}
    </p>
  );
}

function FieldLabel({
  htmlFor,
  thai,
  english,
  required = true,
}: {
  htmlFor: string;
  thai: string;
  english: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2 text-base font-bold text-[#1A1A1A]">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full bg-[#0269A7]"
        />
        {thai}
        {required && (
          <span aria-hidden className="text-[#F04A24]">
            *
          </span>
        )}
      </span>
      <span
        className="pl-5 text-sm text-[#1A1A1A]/55"
        style={{ fontFamily: 'var(--font-heading), sans-serif' }}
      >
        {english}
      </span>
    </label>
  );
}

const EMPTY_MEMBER = {
  fullName: '',
  nickname: '',
  age: '' as unknown as number,
  educationLevel: '' as unknown as (typeof EDUCATION_LEVELS)[number],
  educationLevelOther: '',
  institution: '',
  phone: '',
  lineId: '',
  email: '',
};

export default function RegisterForm() {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      teamName: '',
      productDescription: '',
      members: [{ ...EMPTY_MEMBER }],
      pdpaConsent: false as unknown as true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'members',
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pdpaOpen, setPdpaOpen] = useState(false);

  const onSubmit = async (data: RegistrationInput) => {
    setSubmitError(null);
    const res = await submitRegistration(data);
    if (!res.ok) {
      setSubmitError(
        'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่ / Submission failed, please try again',
      );
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex w-full flex-col gap-6 rounded-3xl bg-white p-6 text-center shadow-lg">
        <span
          className="text-2xl font-bold leading-[1.2]"
          style={{ color: '#0269A7' }}
        >
          อัพเดทสำเร็จ!
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-base leading-relaxed text-[#1A1A1A]/75">
            ขอบคุณที่ช่วยอัพเดทข้อมูลให้นะ เราจะติดต่อกลับเร็ว ๆ นี้
          </span>
          <span
            className="text-sm leading-relaxed text-[#1A1A1A]/55"
            style={{ fontFamily: 'var(--font-heading), sans-serif' }}
          >
            Thank you for updating your info. We will contact you soon.
          </span>
        </span>
        <a
          href="https://www.instagram.com/innovators.th/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[56px] w-full flex-col items-center justify-center rounded-full px-8 text-white shadow-lg transition-transform active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #0269A7, #08A86B)',
          }}
        >
          <span className="text-lg font-bold">ติดตามข่าวสารทาง IG</span>
          <span
            className="text-sm font-normal opacity-90"
            style={{ fontFamily: 'var(--font-heading), sans-serif' }}
          >
            Follow us on IG
          </span>
        </a>
      </div>
    );
  }

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-6 rounded-3xl bg-white p-6 shadow-lg"
      >
        {/* ── ชื่อทีม/แบรนด์ ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel
            htmlFor="teamName"
            thai="ชื่อทีม/ชื่อแบรนด์"
            english="Team / Brand Name"
          />
          <p className="pl-5 text-xs text-[#1A1A1A]/40">
            เปลี่ยนภายหลังได้ / Can be changed later
          </p>
          <input
            id="teamName"
            type="text"
            aria-invalid={errors.teamName ? 'true' : undefined}
            className={INPUT_CLASS}
            {...register('teamName')}
          />
          <FieldError message={errors.teamName?.message} />
        </div>

        {/* ── รายละเอียดสินค้าอย่างสั้น ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel
            htmlFor="productDescription"
            thai="รายละเอียดสินค้าอย่างสั้น"
            english="Brief Product Description"
          />
          <p className="pl-5 text-xs text-[#1A1A1A]/40">
            ไม่เกิน 5 บรรทัด / Max 5 lines
          </p>
          <textarea
            id="productDescription"
            rows={5}
            aria-invalid={errors.productDescription ? 'true' : undefined}
            className={`${INPUT_CLASS} min-h-[120px] py-3`}
            {...register('productDescription')}
          />
          <FieldError message={errors.productDescription?.message} />
        </div>

        {/* ── Team Members ── */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-[#1A1A1A]">
            สมาชิกทีม ({fields.length} คน)
          </span>
          <span
            className="text-sm text-[#1A1A1A]/55"
            style={{ fontFamily: 'var(--font-heading), sans-serif' }}
          >
            Team Members ({fields.length})
          </span>
        </div>
        {errors.members?.message && (
          <FieldError message={errors.members.message} />
        )}

        {fields.map((field, index) => {
          const memberErrors = errors.members?.[index];
          const eduLevel = watch(`members.${index}.educationLevel`);
          const isOther = eduLevel === 'อื่นๆ';

          return (
            <div
              key={field.id}
              className="flex flex-col gap-6 rounded-2xl border border-[#1A1A1A]/10 bg-[#FFFAF3]/50 p-5"
            >
              {/* Member header */}
              <div className="flex items-center justify-between">
                <span
                  className="text-base font-bold"
                  style={{ color: '#0269A7' }}
                >
                  สมาชิกคนที่ {index + 1}
                  <span
                    className="ml-1 font-normal"
                    style={{ fontFamily: 'var(--font-heading), sans-serif' }}
                  >
                    / Member {index + 1}
                  </span>
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="rounded-lg px-3 py-1 text-sm text-[#F04A24] transition-colors hover:bg-[#F04A24]/10"
                  >
                    ลบ / Remove
                  </button>
                )}
              </div>

              {/* ── ชื่อ-นามสกุล ── */}
              <div className="flex flex-col gap-2">
                <FieldLabel
                  htmlFor={`members.${index}.fullName`}
                  thai="ชื่อ-นามสกุล"
                  english="Full Name"
                />
                <input
                  id={`members.${index}.fullName`}
                  type="text"
                  aria-invalid={memberErrors?.fullName ? 'true' : undefined}
                  className={INPUT_CLASS}
                  {...register(`members.${index}.fullName`)}
                />
                <FieldError message={memberErrors?.fullName?.message} />
              </div>

              {/* ── ชื่อเล่น ── */}
              <div className="flex flex-col gap-2">
                <FieldLabel
                  htmlFor={`members.${index}.nickname`}
                  thai="ชื่อเล่น"
                  english="Nickname"
                />
                <input
                  id={`members.${index}.nickname`}
                  type="text"
                  aria-invalid={memberErrors?.nickname ? 'true' : undefined}
                  className={INPUT_CLASS}
                  {...register(`members.${index}.nickname`)}
                />
                <FieldError message={memberErrors?.nickname?.message} />
              </div>

              {/* ── อายุ ── */}
              <div className="flex flex-col gap-2">
                <FieldLabel
                  htmlFor={`members.${index}.age`}
                  thai="อายุ"
                  english="Age"
                />
                <input
                  id={`members.${index}.age`}
                  type="number"
                  aria-invalid={memberErrors?.age ? 'true' : undefined}
                  className={INPUT_CLASS}
                  {...register(`members.${index}.age`)}
                />
                <FieldError message={memberErrors?.age?.message} />
              </div>

              {/* ── ระดับชั้น ── */}
              <div className="flex flex-col gap-2">
                <FieldLabel
                  htmlFor={`members.${index}.educationLevel`}
                  thai="ระดับชั้น"
                  english="Education Level"
                />
                <select
                  id={`members.${index}.educationLevel`}
                  aria-invalid={
                    memberErrors?.educationLevel ? 'true' : undefined
                  }
                  className={SELECT_CLASS}
                  defaultValue=""
                  {...register(`members.${index}.educationLevel`)}
                >
                  <option value="" disabled>
                    เลือกระดับชั้น / Select level
                  </option>
                  {EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl} / {EDU_EN[lvl]}
                    </option>
                  ))}
                </select>
                <FieldError message={memberErrors?.educationLevel?.message} />

                {isOther && (
                  <div className="flex flex-col gap-2 pt-2">
                    <label
                      htmlFor={`members.${index}.educationLevelOther`}
                      className="pl-5 text-sm text-[#1A1A1A]/60"
                    >
                      ระบุระดับชั้น / Specify level{' '}
                      <span className="text-[#F04A24]">*</span>
                    </label>
                    <input
                      id={`members.${index}.educationLevelOther`}
                      type="text"
                      className={INPUT_CLASS}
                      {...register(`members.${index}.educationLevelOther`)}
                    />
                    <FieldError
                      message={memberErrors?.educationLevelOther?.message}
                    />
                  </div>
                )}
              </div>

              {/* ── มหาวิทยาลัย/โรงเรียน ── */}
              <div className="flex flex-col gap-2">
                <FieldLabel
                  htmlFor={`members.${index}.institution`}
                  thai="มหาวิทยาลัย/โรงเรียน"
                  english="University / School"
                />
                <input
                  id={`members.${index}.institution`}
                  type="text"
                  aria-invalid={memberErrors?.institution ? 'true' : undefined}
                  className={INPUT_CLASS}
                  {...register(`members.${index}.institution`)}
                />
                <FieldError message={memberErrors?.institution?.message} />
              </div>

              {/* ── เบอร์โทรศัพท์ ── */}
              <div className="flex flex-col gap-2">
                <FieldLabel
                  htmlFor={`members.${index}.phone`}
                  thai="เบอร์โทรศัพท์"
                  english="Phone Number"
                />
                <input
                  id={`members.${index}.phone`}
                  type="tel"
                  aria-invalid={memberErrors?.phone ? 'true' : undefined}
                  className={INPUT_CLASS}
                  {...register(`members.${index}.phone`)}
                />
                <FieldError message={memberErrors?.phone?.message} />
              </div>

              {/* ── ไลน์ไอดี (optional) ── */}
              <div className="flex flex-col gap-2">
                <FieldLabel
                  htmlFor={`members.${index}.lineId`}
                  thai="ไลน์ไอดี"
                  english="LINE ID (optional)"
                  required={false}
                />
                <input
                  id={`members.${index}.lineId`}
                  type="text"
                  className={INPUT_CLASS}
                  {...register(`members.${index}.lineId`)}
                />
              </div>

              {/* ── อีเมล ── */}
              <div className="flex flex-col gap-2">
                <FieldLabel
                  htmlFor={`members.${index}.email`}
                  thai="อีเมล"
                  english="Email"
                />
                <input
                  id={`members.${index}.email`}
                  type="email"
                  aria-invalid={memberErrors?.email ? 'true' : undefined}
                  className={INPUT_CLASS}
                  {...register(`members.${index}.email`)}
                />
                <FieldError message={memberErrors?.email?.message} />
              </div>
            </div>
          );
        })}

        {/* ── Add member button ── */}
        <button
          type="button"
          onClick={() => append({ ...EMPTY_MEMBER })}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#0269A7]/30 text-[#0269A7] transition-colors hover:border-[#0269A7] hover:bg-[#0269A7]/5"
        >
          <span className="text-xl">+</span>
          <span className="font-bold">
            เพิ่มสมาชิก{' '}
            <span style={{ fontFamily: 'var(--font-heading), sans-serif' }}>
              / Add Member
            </span>
          </span>
        </button>

        {/* ── PDPA Consent ── */}
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-[#1A1A1A]/30 accent-[#0269A7]"
              {...register('pdpaConsent')}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm text-[#1A1A1A]/70">
                ข้าพเจ้ายินยอมให้เก็บรวบรวมและใช้ข้อมูลส่วนบุคคลตาม
                <button
                  type="button"
                  onClick={() => setPdpaOpen(true)}
                  className="text-[#0269A7] underline"
                >
                  นโยบาย PDPA
                </button>
              </span>
              <span
                className="text-xs text-[#1A1A1A]/45"
                style={{ fontFamily: 'var(--font-heading), sans-serif' }}
              >
                I consent to the collection and use of personal data per the{' '}
                <button
                  type="button"
                  onClick={() => setPdpaOpen(true)}
                  className="text-[#0269A7] underline"
                >
                  PDPA policy
                </button>
              </span>
            </span>
          </label>
          <FieldError message={errors.pdpaConsent?.message} />
        </div>

        {/* ── Submit error ── */}
        {submitError && (
          <p role="alert" className="text-center text-sm text-[#F04A24]">
            {submitError}
          </p>
        )}

        {/* ── Submit button ── */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex min-h-[56px] w-full items-center justify-center rounded-full px-8 text-lg font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #0269A7, #08A86B)',
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              กำลังส่ง...
            </span>
          ) : (
            <span className="flex flex-col">
              <span>ส่งข้อมูล</span>
              <span
                className="text-sm font-normal opacity-90"
                style={{ fontFamily: 'var(--font-heading), sans-serif' }}
              >
                Register
              </span>
            </span>
          )}
        </button>
      </form>

      {/* ── PDPA Modal ── */}
      {pdpaOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPdpaOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold text-[#1A1A1A]">
              นโยบายความเป็นส่วนตัว / PDPA Policy
            </h2>
            <div className="flex flex-col gap-3 text-sm text-[#1A1A1A]/60">
              <p>
                Innovator&apos;s Academy
                เก็บรวบรวมข้อมูลส่วนบุคคลของท่านเพื่อใช้ในการดำเนินโครงการเท่านั้น
                ข้อมูลจะถูกเก็บรักษาอย่างปลอดภัยและไม่เปิดเผยต่อบุคคลภายนอก
              </p>
              <p
                style={{ fontFamily: 'var(--font-heading), sans-serif' }}
              >
                Innovator&apos;s Academy collects your personal data solely for
                program operations. Data is securely stored and not shared with
                third parties.
              </p>
              <p>
                ท่านสามารถขอเข้าถึง แก้ไข
                หรือลบข้อมูลส่วนบุคคลของท่านได้โดยติดต่อทีมงาน
              </p>
              <p
                style={{ fontFamily: 'var(--font-heading), sans-serif' }}
              >
                You may request access, correction, or deletion of your data by
                contacting our team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPdpaOpen(false)}
              className="mt-6 w-full rounded-xl px-4 py-3 font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #0269A7, #08A86B)',
              }}
            >
              ปิด / Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
