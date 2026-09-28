import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

// Completes the Google OAuth redirect started by <CocoonSignIn />.
// A static segment takes precedence over the sibling [[...sign-in]] optional catch-all.
export default function SsoCallbackPage() {
  return (
    <>
      <p className="text-[14px] font-medium text-cocoon-muted">กำลังเข้าสู่ระบบ…</p>
      <AuthenticateWithRedirectCallback />
    </>
  );
}
