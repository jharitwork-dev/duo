// Framework-free best-effort R2 cleanup, called AFTER a delete transaction commits.
import { deleteObject } from '@/lib/r2';

/** Deletes every unique non-empty key; never throws (failures are ignored). */
export async function cleanupR2Objects(
  keys: readonly string[],
  deleter: (key: string) => Promise<void> = deleteObject,
): Promise<void> {
  const unique = [...new Set(keys.filter((k) => typeof k === 'string' && k.length > 0))];
  if (unique.length === 0) return;
  await Promise.allSettled(
    unique.map(async (key) => {
      await deleter(key);
    }),
  );
}
