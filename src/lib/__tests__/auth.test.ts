import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES } from '@/lib/constants';

// Mock @clerk/nextjs/server
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { getCurrentRole, requireRole, getCurrentUserId } from '@/lib/auth';

const mockAuth = vi.mocked(auth);

describe('ROLES constant', () => {
  it('has exactly 4 roles: superadmin, teacher, teacher_pending, student', () => {
    const values = Object.values(ROLES);
    expect(values).toHaveLength(4);
    expect(values).toContain('superadmin');
    expect(values).toContain('teacher');
    expect(values).toContain('teacher_pending');
    expect(values).toContain('student');
  });
});

describe('getCurrentRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no session claims', async () => {
    mockAuth.mockResolvedValue({
      sessionClaims: null,
    } as any);

    const role = await getCurrentRole();
    expect(role).toBeNull();
  });

  it('returns null when metadata has no role', async () => {
    mockAuth.mockResolvedValue({
      sessionClaims: { metadata: {} },
    } as any);

    const role = await getCurrentRole();
    expect(role).toBeNull();
  });

  it('returns the role when present in session claims', async () => {
    mockAuth.mockResolvedValue({
      sessionClaims: { metadata: { role: 'teacher' } },
    } as any);

    const role = await getCurrentRole();
    expect(role).toBe('teacher');
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws Unauthorized when role is not in allowed list', async () => {
    mockAuth.mockResolvedValue({
      sessionClaims: { metadata: { role: 'student' } },
    } as any);

    await expect(requireRole('superadmin', 'teacher')).rejects.toThrow('Unauthorized');
  });

  it('throws Unauthorized when no session claims exist', async () => {
    mockAuth.mockResolvedValue({
      sessionClaims: null,
    } as any);

    await expect(requireRole('student')).rejects.toThrow('Unauthorized');
  });

  it('returns the role when it IS in the allowed list', async () => {
    mockAuth.mockResolvedValue({
      sessionClaims: { metadata: { role: 'superadmin' } },
    } as any);

    const role = await requireRole('superadmin', 'teacher');
    expect(role).toBe('superadmin');
  });

  it('allows teacher_pending as a valid role', async () => {
    mockAuth.mockResolvedValue({
      sessionClaims: { metadata: { role: 'teacher_pending' } },
    } as any);

    const role = await requireRole('teacher_pending');
    expect(role).toBe('teacher_pending');
  });
});

describe('getCurrentUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws Not authenticated when no userId', async () => {
    mockAuth.mockResolvedValue({
      userId: null,
    } as any);

    await expect(getCurrentUserId()).rejects.toThrow('Not authenticated');
  });

  it('returns userId when authenticated', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user_abc123',
    } as any);

    const userId = await getCurrentUserId();
    expect(userId).toBe('user_abc123');
  });
});
