/* eslint-disable @next/next/no-img-element -- Clerk avatar URL */
import { currentUser } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { ProfileSignOut } from '@/components/student/profile-sign-out';

export default async function StudentProfilePage() {
  await requireRole(ROLES.STUDENT);
  const user = await currentUser();

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'นักเรียน';
  const contact =
    user?.primaryEmailAddress?.emailAddress ?? user?.primaryPhoneNumber?.phoneNumber ?? '';

  return (
    <>
      <CocoonHeader variant="home" />
      <div className="px-[33px] pt-4">
        <h1 className="text-[20px] leading-normal font-bold text-cocoon-blue">โปรไฟล์</h1>
        <div className="mt-4 flex flex-col items-center rounded-[12px] border border-cocoon-line bg-white p-6 text-center">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              width={72}
              height={72}
              className="size-[72px] rounded-full object-cover"
            />
          ) : (
            <div className="size-[72px] rounded-full bg-cocoon-blue-soft" />
          )}
          <p className="mt-3 text-[20px] leading-normal font-bold text-cocoon-ink">{name}</p>
          {contact && (
            <p className="text-[14px] leading-normal font-medium break-all text-cocoon-muted">
              {contact}
            </p>
          )}
        </div>
        <div className="mt-6">
          <ProfileSignOut />
        </div>
      </div>
    </>
  );
}
