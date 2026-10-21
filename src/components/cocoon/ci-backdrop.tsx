import Image from 'next/image';

/**
 * build.Innovator watercolor backdrop (cream, peach/orange wash top-right, blue/green wash
 * bottom-left, Cocoon shape decorations). Shared by /register and the full-screen form flow.
 */
export function CiBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: '#FFFAF3' }}
    >
      {/* Top-right peach/orange watercolor wash */}
      <div
        className="absolute -right-28 -top-28 h-[26rem] w-[26rem] rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(circle, rgba(240,74,36,0.20), rgba(251,169,25,0.16) 42%, rgba(255,250,243,0) 70%)',
        }}
      />
      {/* Bottom-left blue watercolor wash */}
      <div
        className="absolute -bottom-28 -left-28 h-[26rem] w-[26rem] rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(circle, rgba(2,105,167,0.20), rgba(8,168,107,0.12) 42%, rgba(255,250,243,0) 70%)',
        }}
      />

      {/* Yellow Cocoon sparkle — left edge, partly off-canvas */}
      <Image
        src="/logos/shapes-11.webp"
        alt=""
        width={240}
        height={240}
        className="absolute -left-12 top-32 h-auto w-44"
      />

      {/* Blue squiggle — right edge, partly off-canvas */}
      <Image
        src="/logos/shapes-10.webp"
        alt=""
        width={240}
        height={240}
        className="absolute -right-16 top-1/2 h-auto w-44 -translate-y-1/2"
      />
    </div>
  );
}
