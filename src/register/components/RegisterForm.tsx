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
  'min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 focus:border-blue-500 focus:outline-none';

const SELECT_CLASS =
  'min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 focus:border-blue-500 focus:outline-none appearance-none';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  const [th, ...rest] = message.split(' / ');
  const en = rest.join(' / ');
  return (
    <p role="alert" className="text-sm text-red-500">
      <span>{th}</span>
      {en && <span className="text-xs opacity-75"> / {en}</span>}
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
      <span className="flex items-center gap-2 text-base font-bold text-gray-900">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full bg-blue-500"
        />
        {thai}
        {required && (
          <span aria-hidden className="text-red-500">
            *
          </span>
        )}
      </span>
      <span className="pl-5 text-sm text-gray-400">{english}</span>
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
        <span className="text-2xl font-bold leading-[1.2] text-blue-600">
          ลงทะเบียนสำเร็จ!
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-base leading-relaxed text-gray-600">
            ขอบคุณที่ลงทะเบียนล่วงหน้า เราจะติดต่อกลับเร็ว ๆ นี้
          </span>
          <span className="text-sm leading-relaxed text-gray-400">
            Thank you for pre-registering. We will contact you soon.
          </span>
        </span>
      </div>
    );
  }

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-8 rounded-3xl bg-white p-6 shadow-lg sm:p-8"
      >
        {/* ── Header ── */}
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            ลงทะเบียนล่วงหน้า
          </h1>
          <p className="text-sm text-gray-400">Pre-Registration</p>
        </div>

        {/* ── ชื่อทีม/แบรนด์ ── */}
        <div className="flex flex-col gap-2">
          <FieldLabel
            htmlFor="teamName"
            thai="ชื่อทีม/ชื่อแบรนด์"
            english="Team / Brand Name"
          />
          <p className="pl-5 text-xs text-gray-400">
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

        {/* ── Team Members ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-900">
              สมาชิกทีม ({fields.length} คน)
            </span>
            <span className="text-sm text-gray-400">
              Team Members ({fields.length})
            </span>
          </div>
          {errors.members?.message && (
            <FieldError message={errors.members.message} />
          )}
        </div>

        {fields.map((field, index) => {
          const memberErrors = errors.members?.[index];
          const eduLevel = watch(`members.${index}.educationLevel`);
          const isOther = eduLevel === 'อื่นๆ';

          return (
            <div
              key={field.id}
              className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-gray-50 p-5"
            >
              {/* Member header */}
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-blue-600">
                  สมาชิกคนที่ {index + 1} / Member {index + 1}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="rounded-lg px-3 py-1 text-sm text-red-500 transition-colors hover:bg-red-50"
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
                      className="pl-5 text-sm text-gray-600"
                    >
                      ระบุระดับชั้น / Specify level{' '}
                      <span className="text-red-500">*</span>
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
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 transition-colors hover:border-blue-500 hover:bg-blue-50"
        >
          <span className="text-xl">+</span>
          <span className="font-bold">เพิ่มสมาชิก / Add Member</span>
        </button>

        {/* ── PDPA Consent ── */}
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-gray-300"
              {...register('pdpaConsent')}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm text-gray-700">
                ข้าพเจ้ายินยอมให้เก็บรวบรวมและใช้ข้อมูลส่วนบุคคลตาม
                <button
                  type="button"
                  onClick={() => setPdpaOpen(true)}
                  className="text-blue-600 underline"
                >
                  นโยบาย PDPA
                </button>
              </span>
              <span className="text-xs text-gray-400">
                I consent to the collection and use of personal data per the{' '}
                <button
                  type="button"
                  onClick={() => setPdpaOpen(true)}
                  className="text-blue-600 underline"
                >
                  PDPA policy
                </button>
              </span>
            </span>
          </label>
          <FieldError
            message={
              errors.pdpaConsent?.message
            }
          />
        </div>

        {/* ── Submit error ── */}
        {submitError && (
          <p role="alert" className="text-center text-sm text-red-500">
            {submitError}
          </p>
        )}

        {/* ── Submit button ── */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex min-h-[56px] w-full items-center justify-center rounded-full bg-blue-600 px-8 text-lg font-bold text-white shadow-lg transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              กำลังส่ง...
            </span>
          ) : (
            <span className="flex flex-col">
              <span>ลงทะเบียน</span>
              <span className="text-sm font-normal opacity-90">Register</span>
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
            <h2 className="mb-4 text-lg font-bold text-gray-900">
              นโยบายความเป็นส่วนตัว / PDPA Policy
            </h2>
            <div className="flex flex-col gap-3 text-sm text-gray-600">
              <p>
                Innovator's Academy
                เก็บรวบรวมข้อมูลส่วนบุคคลของท่านเพื่อใช้ในการดำเนินโครงการเท่านั้น
                ข้อมูลจะถูกเก็บรักษาอย่างปลอดภัยและไม่เปิดเผยต่อบุคคลภายนอก
              </p>
              <p>
                Innovator's Academy collects your personal data solely for
                program operations. Data is securely stored and not shared with
                third parties.
              </p>
              <p>
                ท่านสามารถขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลของท่านได้
                โดยติดต่อทีมงาน
              </p>
              <p>
                You may request access, correction, or deletion of your data by
                contacting our team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPdpaOpen(false)}
              className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
            >
              ปิด / Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
