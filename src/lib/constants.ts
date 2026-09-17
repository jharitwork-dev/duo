export const ROLES = {
  SUPERADMIN: 'superadmin',
  TEACHER: 'teacher',
  TEACHER_PENDING: 'teacher_pending',
  STUDENT: 'student',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROUTES = {
  SIGN_IN: '/sign-in',
  SIGN_UP: '/sign-up',
  ONBOARDING: '/onboarding',
  TEACHER_DASHBOARD: '/teacher',
  STUDENT_DASHBOARD: '/student',
  ADMIN_DASHBOARD: '/admin',
} as const;
