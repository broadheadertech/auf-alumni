"use client";

/**
 * Split-screen auth layout (ported from Claude Design prototype).
 * Left: form + chrome.  Right: deep-navy branded rail with a quote, stats,
 * or signup-progress checklist. Mobile collapses to the form only.
 */

import Link from "next/link";
import { AUFInlineLockup, AUFLockup } from "./AUFMark";
import { AUFAvatar } from "./AUFAvatar";

type AuthShellProps = {
  title: string;
  sub: string;
  children: React.ReactNode;
  rail?: React.ReactNode;
};

export function AuthShell({ title, sub, children, rail }: AuthShellProps) {
  return (
    <div className="min-h-screen grid grid-cols-12" style={{ background: "var(--bg)" }}>
      {/* Left: form */}
      <div className="col-span-12 lg:col-span-6 flex flex-col">
        <div className="px-6 sm:px-10 py-7 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <AUFInlineLockup />
          </Link>
          <Link href="/" className="text-[13px] ink-3 hover:ink-2">
            ← Back to home
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-8">
          <div className="w-full max-w-[420px]">
            <h1 className="font-serif text-[32px] sm:text-[36px] font-semibold leading-tight">
              {title}
            </h1>
            <p className="text-[14.5px] ink-2 mt-2 leading-[1.55]">{sub}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <div className="px-6 sm:px-10 py-6 text-[12px] ink-3 flex items-center justify-between border-t auf-hairline">
          <div>© 2026 Angeles University Foundation</div>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="hover:ink-2">Privacy</Link>
            <Link href="/legal/terms" className="hover:ink-2">Terms</Link>
            <Link href="/help" className="hover:ink-2">Help</Link>
          </div>
        </div>
      </div>

      {/* Right: branded panel */}
      <div
        className="hidden lg:flex col-span-6 relative overflow-hidden"
        style={{ background: "var(--brand-deep)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, white 0%, transparent 40%), radial-gradient(circle at 80% 100%, var(--gold) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            background:
              "repeating-linear-gradient(45deg, transparent 0 32px, rgba(255,255,255,0.4) 32px 33px)",
          }}
        />
        <div className="relative w-full p-14 flex flex-col text-white">
          {/* Centred, intrinsic-width lockup — no full-row stretch. */}
          <div className="self-center shrink-0">
            <AUFLockup height={48} />
          </div>
          {rail ?? <DefaultAuthRail />}
        </div>
      </div>
    </div>
  );
}

function DefaultAuthRail() {
  return (
    <div className="mt-auto">
      <blockquote
        className="font-serif text-[22px] xl:text-[26px] leading-[1.4] font-medium"
        style={{ color: "rgba(255,255,255,0.95)" }}
      >
        &ldquo;Three batchmates reached out the first day. I had a referral at
        GCash within the week.&rdquo;
      </blockquote>
      <div className="flex items-center gap-3 mt-6">
        <AUFAvatar name="Mark Lim" grad={4} size={44} />
        <div>
          <div className="font-medium text-[14px]">Mark Lim</div>
          <div className="text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            BS Multimedia Arts &apos;19 · Designer at GCash
          </div>
        </div>
      </div>

      <div
        className="mt-10 pt-8 grid grid-cols-3 gap-5 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
      >
        <RailStat v="38K+" l="Verified alumni" />
        <RailStat v="1,200+" l="Open jobs" />
        <RailStat v="71" l="Countries" />
      </div>
    </div>
  );
}

function RailStat({ v, l }: { v: string; l: string }) {
  return (
    <div>
      <div
        className="font-serif text-[24px] xl:text-[28px] font-semibold leading-none"
        style={{ color: "var(--gold)" }}
      >
        {v}
      </div>
      <div className="text-[11px] uppercase tracking-wider mt-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
        {l}
      </div>
    </div>
  );
}

/**
 * Re-usable form field row matching the design's `<Field/>`.
 */
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={htmlFor} className="text-[12.5px] font-medium ink-2">
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}
