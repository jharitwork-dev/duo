'use client';

import { UserButton } from '@clerk/nextjs';

export function UserNav() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <UserButton />
    </div>
  );
}
