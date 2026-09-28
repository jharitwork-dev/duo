export function ComingSoonCard({ description }: { description: string }) {
  return (
    <div className="mt-4 rounded-[12px] border border-cocoon-line bg-white p-6 text-center">
      <p className="text-[16px] leading-normal font-bold text-cocoon-ink">เร็ว ๆ นี้</p>
      <p className="mt-1 text-[14px] leading-normal font-medium text-cocoon-muted">{description}</p>
    </div>
  );
}
