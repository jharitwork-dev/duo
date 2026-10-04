import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanupR2Objects } from '@/lib/r2-cleanup';
import { deleteObject } from '@/lib/r2';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('cleanupR2Objects', () => {
  it('calls the deleter once per unique non-empty key', async () => {
    const deleter = vi.fn().mockResolvedValue(undefined);
    await cleanupR2Objects(['a', 'b', 'a', '', 'b'], deleter);
    expect(deleter).toHaveBeenCalledTimes(2);
    expect(deleter).toHaveBeenCalledWith('a');
    expect(deleter).toHaveBeenCalledWith('b');
  });

  it('resolves even when the deleter rejects or throws', async () => {
    const deleter = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementationOnce(() => {
        throw new Error('sync boom');
      });
    await expect(cleanupR2Objects(['a', 'b'], deleter)).resolves.toBeUndefined();
    expect(deleter).toHaveBeenCalledTimes(2);
  });

  it('does nothing for an empty list', async () => {
    const deleter = vi.fn();
    await cleanupR2Objects([], deleter);
    expect(deleter).not.toHaveBeenCalled();
  });
});

describe('deleteObject without R2 env', () => {
  it('resolves undefined and never calls fetch', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', '');
    vi.stubEnv('R2_ACCESS_KEY_ID', '');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '');
    vi.stubEnv('R2_BUCKET', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(deleteObject('x')).resolves.toBeUndefined();
    await expect(cleanupR2Objects(['x', 'y'])).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
