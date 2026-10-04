/* eslint-disable @next/next/no-img-element -- Clerk avatar URL */
import { ProfileSignOut } from '@/components/student/profile-sign-out';
import { ProfileName } from './profile-name';

interface ProfileCardProps {
  name: string;
  contact: string;
  imageUrl?: string | null;
  roleLabel: string;
}

// Shared profile body for every role (avatar, editable name, contact, role label, sign-out).
export function ProfileCard({ name, contact, imageUrl, roleLabel }: ProfileCardProps) {
  return (
    <div className="px-[33px] pt-4 lg:mx-auto lg:max-w-[560px] lg:px-0 lg:pt-10">
      <h1 className="text-[20px] leading-normal font-bold text-cocoon-blue lg:text-[30px]">โปรไฟล์</h1>
      <div className="mt-4 flex flex-col items-center rounded-[12px] border border-cocoon-line bg-white p-6 text-center lg:rounded-[16px] lg:border-[#f1ece5] lg:p-8">
        {imageUrl ? (
          <img src={imageUrl} alt="" width={72} height={72} className="size-[72px] rounded-full object-cover" />
        ) : (
          <div className="size-[72px] rounded-full bg-cocoon-blue-soft" />
        )}
        <ProfileName name={name} />
        {contact && (
          <p className="text-[14px] leading-normal font-medium break-all text-cocoon-muted">{contact}</p>
        )}
        <span className="mt-2 inline-flex h-[26px] items-center rounded-full bg-cocoon-blue-soft px-3 text-[12px] leading-normal font-bold text-cocoon-blue">
          {roleLabel}
        </span>
      </div>
      <div className="mt-6">
        <ProfileSignOut />
      </div>
    </div>
  );
}
