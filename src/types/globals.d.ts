export type UserRole = 'superadmin' | 'teacher' | 'teacher_pending' | 'student';

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: UserRole;
    };
  }
}
