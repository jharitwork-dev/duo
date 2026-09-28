import { currentUser } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { ProfileCard } from '@/components/cocoon/profile-card';

export default async function TeacherProfilePage() {
  const role = await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const user = await currentUser();

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'ครู';
  const contact =
    user?.primaryEmailAddress?.emailAddress ?? user?.primaryPhoneNumber?.phoneNumber ?? '';

  return (
    <>
      <CocoonHeader variant="home" />
      <ProfileCard
        name={name}
        contact={contact}
        imageUrl={user?.imageUrl}
        roleLabel={role === ROLES.SUPERADMIN ? 'ผู้ดูแลระบบ' : 'ครู'}
      />
    </>
  );
}
