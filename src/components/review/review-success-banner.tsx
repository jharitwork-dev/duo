import { REVIEW_SENT_BACK_BANNER, REVIEW_SUCCESS_BANNER } from '@/lib/review';

// Success banner after a review (design/mac home-17): shown when ?done=approved|rejected.
export function ReviewSuccessBanner({ done }: { done: 'approved' | 'rejected' | null }) {
  if (!done) return null;
  return (
    <p
      role="status"
      className="rounded-[12px] border border-cocoon-green/30 bg-[rgb(0_168_107/.1)] px-4 py-3 text-[15px] leading-normal font-bold text-cocoon-green"
    >
      {done === 'approved' ? REVIEW_SUCCESS_BANNER : REVIEW_SENT_BACK_BANNER}
    </p>
  );
}
