import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CreateClassroomForm } from '@/components/classroom/create-classroom-form';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { PAGE_BODY } from '@/components/cocoon/ui';

export default async function NewClassroomPage() {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);

  return (
    <>
      <CocoonHeader variant="back" backHref="/teacher" />
      <PageHeader backHref="/teacher" backLabel="ทีมของฉัน" title="สร้างห้องเรียน" subtitle="ตั้งชื่อและรายละเอียดห้องเรียนใหม่" />
      <div className={PAGE_BODY}>
        <div className="lg:max-w-[640px]">
          <CreateClassroomForm />
        </div>
      </div>
    </>
  );
}
