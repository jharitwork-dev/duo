'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  FileCheck,
  Settings,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import { cn } from 'cn';
import type { UserRole } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { UserNav } from '@/components/user-nav';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const teacherNav: NavItem[] = [
  { label: 'ห้องเรียน', href: '/teacher', icon: BookOpen },
  { label: 'งานที่ส่ง', href: '/teacher/submissions', icon: FileCheck },
  { label: 'ตั้งค่า', href: '/teacher/settings', icon: Settings },
];

const studentNav: NavItem[] = [
  { label: 'ห้องเรียนของฉัน', href: '/student', icon: BookOpen },
  { label: 'ความก้าวหน้า', href: '/student/progress', icon: GraduationCap },
];

const adminNav: NavItem[] = [
  { label: 'อนุมัติครู', href: '/admin', icon: ShieldCheck },
];

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case 'superadmin':
      return [...adminNav, ...teacherNav];
    case 'teacher':
      return teacherNav;
    case 'student':
      return studentNav;
    case 'teacher_pending':
      return [];
  }
}

function getRoleBadgeLabel(role: UserRole): string {
  switch (role) {
    case 'superadmin':
      return 'ผู้ดูแลระบบ';
    case 'teacher':
      return 'คุณครู';
    case 'student':
      return 'นักเรียน';
    case 'teacher_pending':
      return 'รอการอนุมัติ';
  }
}

interface AppSidebarProps {
  role: UserRole;
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role);

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">Duo</span>
          <Badge variant="secondary" className="text-xs">
            {getRoleBadgeLabel(role)}
          </Badge>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {role === 'teacher_pending' ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            <Badge variant="outline">รอการอนุมัติ</Badge>
            <p className="mt-2">บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ</p>
          </div>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>เมนู</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
                    >
                      <item.icon className={cn('size-4')} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <UserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
