// Pre-registration form schema — shared client/server zod validation.
// Team registration: team/brand name + dynamic list of members.

import * as z from 'zod';

/** The 9 selectable education levels; 'อื่นๆ' reveals a required free-text detail. */
export const EDUCATION_LEVELS = [
  'ม.4',
  'ม.5',
  'ม.6',
  'ปี 1',
  'ปี 2',
  'ปี 3',
  'ปี 4',
  'ป.โท',
  'อื่นๆ',
] as const;

/** English display text for each education level. */
export const EDU_EN: Record<(typeof EDUCATION_LEVELS)[number], string> = {
  'ม.4': 'Grade 10',
  'ม.5': 'Grade 11',
  'ม.6': 'Grade 12',
  'ปี 1': 'Year 1',
  'ปี 2': 'Year 2',
  'ปี 3': 'Year 3',
  'ปี 4': 'Year 4',
  'ป.โท': 'Master',
  'อื่นๆ': 'Other',
};

/** Schema for a single team member. */
export const memberSchema = z
  .object({
    fullName: z
      .string({ error: 'กรุณากรอกชื่อ-นามสกุล / Please enter full name' })
      .trim()
      .min(1, { error: 'กรุณากรอกชื่อ-นามสกุล / Please enter full name' }),
    nickname: z
      .string({ error: 'กรุณากรอกชื่อเล่น / Please enter nickname' })
      .trim()
      .min(1, { error: 'กรุณากรอกชื่อเล่น / Please enter nickname' }),
    age: z.coerce
      .number({ error: 'กรุณากรอกอายุ / Please enter age' })
      .int({ error: 'กรุณากรอกอายุ / Please enter age' })
      .min(1, { error: 'กรุณากรอกอายุ / Please enter age' })
      .max(99, { error: 'กรุณากรอกอายุ / Please enter age' }),
    educationLevel: z.enum(EDUCATION_LEVELS, {
      error: 'กรุณาเลือกระดับชั้น / Please select education level',
    }),
    educationLevelOther: z.string().trim().optional(),
    institution: z
      .string({ error: 'กรุณากรอกมหาวิทยาลัย/โรงเรียน / Please enter university or school' })
      .trim()
      .min(1, { error: 'กรุณากรอกมหาวิทยาลัย/โรงเรียน / Please enter university or school' }),
    phone: z
      .string({ error: 'กรุณากรอกเบอร์โทรศัพท์ / Please enter phone number' })
      .trim()
      .min(9, { error: 'กรุณากรอกเบอร์โทรศัพท์ / Please enter phone number' }),
    lineId: z.string().trim().optional(),
    email: z.email({ error: 'อีเมลไม่ถูกต้อง / Invalid email' }),
  })
  .superRefine((data, ctx) => {
    if (data.educationLevel === 'อื่นๆ' && !data.educationLevelOther?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['educationLevelOther'],
        message: 'กรุณาระบุระดับชั้น / Please specify your level',
      });
    }
  });

/** Full registration schema: team name + 1..10 members + PDPA consent. */
export const registrationSchema = z.object({
  teamName: z
    .string({ error: 'กรุณากรอกชื่อทีม/แบรนด์ / Please enter team/brand name' })
    .trim()
    .min(1, { error: 'กรุณากรอกชื่อทีม/แบรนด์ / Please enter team/brand name' }),
  members: z
    .array(memberSchema)
    .min(1, { error: 'ต้องมีสมาชิกอย่างน้อย 1 คน / At least 1 member required' }),
  pdpaConsent: z.literal(true, {
    error: 'กรุณายอมรับเงื่อนไข PDPA / Please accept the PDPA terms',
  }),
});

export type MemberInput = z.infer<typeof memberSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
