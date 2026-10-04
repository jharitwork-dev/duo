'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const nameSchema = z.string().trim().min(1, 'กรุณากรอกชื่อ').max(60, 'ชื่อยาวเกินไป (สูงสุด 60 ตัวอักษร)');

export type UpdateNameResult = { success: true; name: string } | { success: false; error: string };

/** Let any signed-in user rename themselves. Names are read live from Clerk everywhere. */
export async function updateMyName(raw: string): Promise<UpdateNameResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'กรุณาเข้าสู่ระบบ' };

  const parsed = nameSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'ชื่อไม่ถูกต้อง' };

  // Collapse inner whitespace; first word → firstName, the rest → lastName.
  const name = parsed.data.replace(/\s+/g, ' ');
  const [firstName, ...rest] = name.split(' ');

  const client = await clerkClient();
  await client.users.updateUser(userId, { firstName, lastName: rest.join(' ') });

  revalidatePath('/', 'layout');
  return { success: true, name };
}
