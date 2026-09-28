import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { ComingSoonCard } from '@/components/cocoon/coming-soon-card';

export default async function StudentDeadlinesPage() {
  await requireRole(ROLES.STUDENT);

  return (
    <>
      <CocoonHeader variant="home" />
      <div className="px-[33px] pt-4 lg:px-0 lg:pt-[26px]">
        <h1 className="text-[20px] leading-normal font-bold text-cocoon-blue lg:text-[30px]">กำหนดส่ง</h1>
        <ComingSoonCard description="ดูกำหนดส่งงานที่ใกล้จะถึงได้ที่นี่" />
      </div>
    </>
  );
}
