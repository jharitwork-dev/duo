import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { ComingSoonCard } from '@/components/cocoon/coming-soon-card';

export default async function StudentTasksPage() {
  await requireRole(ROLES.STUDENT);

  return (
    <>
      <CocoonHeader variant="home" />
      <div className="px-[33px] pt-4">
        <h1 className="text-[20px] leading-normal font-bold text-cocoon-blue">งานของฉัน</h1>
        <ComingSoonCard description="รวมงานทั้งหมดของคุณจากทุก Phase ไว้ในที่เดียว" />
      </div>
    </>
  );
}
