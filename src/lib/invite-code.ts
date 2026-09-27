import { db } from '@/db';
import { classrooms } from '@/db/schema/classrooms';
import { eq } from 'drizzle-orm';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(length = 6): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => CHARS[b % CHARS.length]).join('');
}

export async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const existing = await db.query.classrooms.findFirst({
      where: eq(classrooms.inviteCode, code),
    });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique invite code');
}
