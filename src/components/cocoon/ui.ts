// Cocoon visual-language class strings for screens without a Figma design (teacher/admin).
// Plain module (no 'use client') so server and client components can both import it.

/** Content column under PageHeader: 33px gutter on mobile, frame column on desktop. */
export const PAGE_BODY = 'px-[33px] pt-4 pb-6 lg:px-0 lg:pt-8';

export const CARD = 'rounded-[16px] border border-[#f1ece5] bg-white p-5 lg:p-7';
export const CARD_TITLE = 'text-[18px] leading-normal font-bold text-cocoon-blue lg:text-[20px]';
export const CARD_META = 'text-[14px] leading-normal font-medium text-cocoon-muted';

const BTN = 'h-[49px] rounded-[12px] px-5 text-[16px] font-bold';
/** Orange (primary token). */
export const BTN_PRIMARY = `${BTN} bg-primary text-primary-foreground hover:bg-primary/90`;
/** Solid blue (info / "เช็คงาน" style). */
export const BTN_INFO = `${BTN} bg-cocoon-blue text-white hover:bg-cocoon-blue/90`;
/** White with a line border. */
export const BTN_TERTIARY = `${BTN} border border-cocoon-line bg-white text-cocoon-blue hover:bg-cocoon-blue-soft`;
/** Green approve. */
export const BTN_APPROVE = `${BTN} bg-cocoon-green text-white hover:bg-cocoon-green/90`;

export const INPUT = 'h-12 rounded-[12px] border-[#f1ece5] bg-[#fffaf3] px-4 text-[16px] md:text-[16px]';
export const TEXTAREA = 'rounded-[12px] border-[#f1ece5] bg-[#fffaf3] px-4 py-3 text-[16px] md:text-[16px]';
export const LABEL = 'text-[14px] font-bold text-cocoon-ink';

/** Segmented pill tabs (design/mac home-11). Pass to TabsList / TabsTrigger. */
export const SEGMENT_LIST =
  'h-[47px] w-full rounded-full border border-[#f1ece5] bg-white p-0 lg:w-auto group-data-horizontal/tabs:h-[47px]';
export const SEGMENT_TRIGGER =
  'h-full flex-1 rounded-full px-8 text-[16px] font-bold text-cocoon-blue data-active:bg-cocoon-blue data-active:text-white data-active:shadow-none lg:flex-none';

/** Dashed "+ เพิ่ม…" inline add button. */
export const ADD_ROW =
  'flex h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-cocoon-blue/40 bg-cocoon-blue-soft text-[15px] font-bold text-cocoon-blue hover:bg-cocoon-blue-soft/70';

/** Dialog panel (home-13 language). Pass to DialogContent className. */
export const DIALOG_PANEL = 'rounded-[20px] bg-white p-6 sm:max-w-[480px] lg:p-8';
export const DIALOG_TITLE = 'text-center text-[22px] font-bold text-cocoon-ink lg:text-[26px]';

/** Empty-state card. */
export const EMPTY_CARD = `${CARD} flex flex-col items-center gap-4 py-10 text-center`;

/** Destructive orange-red (delete confirmations). */
export const BTN_DANGER = `${BTN} bg-[#e8590c] text-white hover:bg-[#e8590c]/90`;

/** Small "เต็ม" pill on full groups. */
export const PILL_FULL =
  'inline-flex h-[22px] shrink-0 items-center rounded-full bg-[#fff1e8] px-2.5 text-[12px] font-bold text-[#e8590c]';

/** Capacity pill ("3/5 คน"). */
export const PILL_CAPACITY =
  'inline-flex h-[26px] shrink-0 items-center gap-1 rounded-full bg-cocoon-blue-soft px-3 text-[12px] font-bold text-cocoon-blue';

/** Native <select> in the INPUT language. */
export const SELECT =
  'h-10 min-w-0 rounded-[12px] border border-[#f1ece5] bg-[#fffaf3] px-3 text-[14px] font-medium text-cocoon-ink outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 disabled:opacity-50';
