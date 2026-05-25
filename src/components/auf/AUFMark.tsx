/**
 * AUF brand marks (ported from the Claude Design prototype).
 *
 * - <AUFLockup/>   — full white-on-dark lockup; place on a dark band
 * - <AUFMark/>     — seal-only crop; safe on light surfaces
 * - <AUFWordmark/> — the sidebar block: lockup + "Alumni Network · Careers"
 *
 * The seal is cropped from the left ~28% of the official lockup image.
 */

import Image from "next/image";

export function AUFLockup({ height = 36 }: { height?: number }) {
  // Lock width to the source 263×75 aspect ratio so parent flex containers
  // can't stretch the image. `maxWidth: 'none'` defeats Tailwind's
  // `max-w-full` reset.
  const width = Math.round((height * 263) / 75);
  return (
    <Image
      src="/auf-logo.png"
      alt="Angeles University Foundation"
      width={width}
      height={height}
      priority
      style={{
        height,
        width,
        maxWidth: "none",
        display: "block",
        flexShrink: 0,
      }}
    />
  );
}

export function AUFMark({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, position: "relative", overflow: "hidden" }}
      aria-label="Angeles University Foundation seal"
    >
      <Image
        src="/auf-logo.png"
        alt=""
        width={Math.round(size * 3.7)}
        height={Math.round(size * 1.05)}
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          height: size * 1.05,
          width: "auto",
          transform: "translateY(-50%)",
          objectFit: "cover",
          objectPosition: "left center",
          clipPath: "inset(0 72% 0 0)",
        }}
      />
    </div>
  );
}

export function AUFWordmark() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--brand-deep)" }}>
      <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-center">
        <AUFLockup height={28} />
      </div>
      <div
        className="px-3.5 pb-2.5 pt-1.5 flex items-center justify-between border-t whitespace-nowrap"
        style={{ borderColor: "rgba(255,255,255,0.10)" }}
      >
        <div className="font-serif text-[11.5px] font-semibold text-white tracking-tight">
          Alumni Network
        </div>
        <div
          className="text-[9px] uppercase tracking-[0.16em] font-medium"
          style={{ color: "var(--gold)" }}
        >
          Careers
        </div>
      </div>
    </div>
  );
}

/**
 * Compact AUF lockup for marketing/auth top-nav (square seal on a navy
 * tile + a wordmark to its right).
 */
export function AUFInlineLockup() {
  // Full AUF lockup (white-on-dark) on a navy band, with the "AUF Alumni /
  // NETWORK & CAREERS" tagline stacked beneath it. The lockup PNG has white
  // text that needs a dark surface to read.
  return (
    <span className="flex flex-col items-start gap-1">
      <span
        className="rounded-md px-2.5 py-1.5 inline-flex"
        style={{ background: "var(--brand-deep)" }}
      >
        <AUFLockup height={18} />
      </span>
      <span className="leading-tight text-left">
        <span className="block font-serif font-semibold text-[11.5px] tracking-tight">
          AUF Alumni
        </span>
        <span className="block text-[8.5px] uppercase tracking-[0.16em] ink-3 -mt-0.5">
          Network &amp; Careers
        </span>
      </span>
    </span>
  );
}
