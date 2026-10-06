// Server-only: resolves Clerk user IDs to display info for teacher-facing member lists.
import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { publicDisplayName } from '@/lib/comment-thread';
import { ROLES } from '@/lib/constants';

export interface UserDisplay {
  /** Teacher-facing: may fall back to the email. Never show to students. */
  name: string;
  /** Safe for every viewer: full name, then username, never the email. */
  publicName: string;
  email: string | null;
  imageUrl: string | null;
}

const UNKNOWN_NAME = 'ไม่ระบุชื่อ';

/**
 * Batch-fetches Clerk users (one request per 100 ids) and returns a map keyed by user id.
 * Missing/deleted users fall back to a placeholder so lists never show raw ids.
 */
export async function getUserDirectory(userIds: string[]): Promise<Map<string, UserDisplay>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const directory = new Map<string, UserDisplay>();
  if (ids.length === 0) return directory;

  const client = await clerkClient();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { data } = await client.users.getUserList({ userId: batch, limit: batch.length });
    for (const user of data) {
      const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      directory.set(user.id, {
        name: fullName || user.username || email || UNKNOWN_NAME,
        publicName: publicDisplayName(user),
        email,
        imageUrl: user.hasImage ? user.imageUrl : null,
      });
    }
  }

  for (const id of ids) {
    if (!directory.has(id)) directory.set(id, { name: UNKNOWN_NAME, publicName: UNKNOWN_NAME, email: null, imageUrl: null });
  }
  return directory;
}

export interface TeacherOption {
  userId: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
}

const TEACHER_PAGE_SIZE = 500;
const TEACHER_MAX_PAGES = 5;

/** Every Clerk user whose global role is 'teacher' (approved), sorted by name (Thai collation). */
export async function listApprovedTeachers(): Promise<TeacherOption[]> {
  const client = await clerkClient();
  const teachers: TeacherOption[] = [];
  for (let page = 0; page < TEACHER_MAX_PAGES; page++) {
    const { data } = await client.users.getUserList({
      limit: TEACHER_PAGE_SIZE,
      offset: page * TEACHER_PAGE_SIZE,
      orderBy: '-created_at',
    });
    for (const user of data) {
      if ((user.publicMetadata as { role?: string } | undefined)?.role !== ROLES.TEACHER) continue;
      const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      teachers.push({
        userId: user.id,
        name: fullName || user.username || email || UNKNOWN_NAME,
        email,
        imageUrl: user.hasImage ? user.imageUrl : null,
      });
    }
    if (data.length < TEACHER_PAGE_SIZE) break;
  }
  return teachers.sort((a, b) => a.name.localeCompare(b.name, 'th'));
}
