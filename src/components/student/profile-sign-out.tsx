'use client';

import { useState } from 'react';
import { useClerk } from '@clerk/nextjs';

export function ProfileSignOut() {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await signOut({ redirectUrl: '/sign-in' });
        } finally {
          setPending(false);
        }
      }}
      className="h-[55px] w-full rounded-[12px] bg-cocoon-orange text-[16px] font-bold text-white transition-opacity disabled:opacity-50"
    >
      {pending ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
    </button>
  );
}
