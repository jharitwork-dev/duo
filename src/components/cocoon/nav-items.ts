import {
  Calendar,
  ClipboardCheck,
  House,
  ShieldCheck,
  SquareCheck,
  User,
  type LucideIcon,
} from 'lucide-react';

// Per-role navigation shared by the mobile BottomTabBar and the desktop DesktopHeader.
export type NavRole = 'student' | 'teacher' | 'superadmin';

export interface NavItem {
  href: string;
  label: string;
  /** Label used in the desktop header when it differs from the tab-bar label. */
  desktopLabel?: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

const startsWith = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const STUDENT_ITEMS: NavItem[] = [
  {
    href: '/student',
    label: 'หน้าแรก',
    icon: House,
    match: (p) => p === '/student' || startsWith(p, '/student/classroom') || startsWith(p, '/todo'),
  },
  {
    href: '/student/tasks',
    label: 'งานของฉัน',
    icon: SquareCheck,
    match: (p) => startsWith(p, '/student/tasks'),
  },
  {
    href: '/student/deadlines',
    label: 'กำหนดส่ง',
    icon: Calendar,
    match: (p) => startsWith(p, '/student/deadlines'),
  },
  {
    href: '/student/profile',
    label: 'โปรไฟล์',
    icon: User,
    match: (p) => startsWith(p, '/student/profile'),
  },
];

const TEACHER_HOME: NavItem = {
  href: '/teacher',
  label: 'หน้าแรก',
  desktopLabel: 'ทีมของฉัน',
  icon: House,
  match: (p) =>
    p === '/teacher' ||
    startsWith(p, '/teacher/classroom') ||
    startsWith(p, '/student/classroom') ||
    startsWith(p, '/todo'),
};

const TEACHER_REVIEW: NavItem = {
  href: '/teacher/review',
  label: 'ตรวจงาน',
  icon: ClipboardCheck,
  match: (p) => startsWith(p, '/teacher/review'),
};

const TEACHER_PROFILE: NavItem = {
  href: '/teacher/profile',
  label: 'โปรไฟล์',
  icon: User,
  match: (p) => startsWith(p, '/teacher/profile'),
};

const ADMIN: NavItem = {
  href: '/admin',
  label: 'แอดมิน',
  icon: ShieldCheck,
  match: (p) => startsWith(p, '/admin'),
};

export function navItemsFor(role: NavRole): NavItem[] {
  switch (role) {
    case 'student':
      return STUDENT_ITEMS;
    case 'teacher':
      return [TEACHER_HOME, TEACHER_REVIEW, TEACHER_PROFILE];
    case 'superadmin':
      return [TEACHER_HOME, TEACHER_REVIEW, ADMIN, TEACHER_PROFILE];
  }
}
