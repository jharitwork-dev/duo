import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { ComingSoonCard } from '@/components/cocoon/coming-soon-card';

// Placeholder until Phase 4 (teacher review, design/mac home-11..17).
export default async function TeacherReviewPage() {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);

  return (
    <>
      <CocoonHeader variant="home" />
      <PageHeader title="ตรวจงาน" subtitle="งานที่นักเรียนส่งเข้ามาให้ตรวจ" />
      <div className="px-[33px] lg:px-0 lg:pt-4">
        <ComingSoonCard description="หน้าตรวจงานจะเปิดให้ใช้งานเร็ว ๆ นี้" />
      </div>
    </>
  );
}
