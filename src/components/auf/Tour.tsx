"use client";

/**
 * Spotlight tour: a step-by-step walkthrough anchored to the real controls on
 * the page.
 *
 * The written guide reads like documentation because it is documentation —
 * you have to hold it in your head and map it onto the screen yourself. This
 * removes that step: the instruction sits beside the actual button it is
 * describing.
 *
 * How the spotlight works: a single absolutely-positioned box is placed over
 * the target's bounding rect and given an enormous `box-shadow` spread. The
 * shadow dims everything outside the box, so there is no SVG mask to keep in
 * sync and the cut-out follows the element's own border radius.
 *
 * Measurement happens inside requestAnimationFrame and scroll/resize
 * listeners rather than synchronously in the effect body — partly because the
 * element must be scrolled into view before its rect means anything, and
 * partly because a synchronous setState in an effect is exactly the cascading
 * render this codebase's lint rule exists to prevent.
 *
 * A step whose target is missing is skipped rather than rendered pointing at
 * nothing, so a tour survives a screen where a control is hidden by role or
 * by an empty state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import {
  tourForPath,
  type Tour as TourDef,
  type TourPlacement,
} from "@/lib/guide/tours";
import { topicForPath, type Surface } from "@/lib/guide/content";
import { cn } from "@/lib/utils";

const GUIDE_ROOT: Record<Surface, string> = {
  alumni: "/guide",
  employer: "/employer/guide",
  admin: "/admin/guide",
};

/* ------------------------------------------------------------- storage */

const OFFERED_KEY = "auf.tour.offered";
const DONE_KEY = "auf.tour.done";

/** localStorage is unavailable in private windows and can throw; never let it break the page. */
function readSet(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function addTo(key: string, value: string) {
  try {
    const set = readSet(key);
    set.add(value);
    window.localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* no-op */
  }
}

/* ---------------------------------------------------------------- rect */

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;

/** Rendered and non-zero. A hidden tab's contents measure 0x0. */
function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}

/**
 * The target's rect, clamped to the viewport.
 *
 * Without the clamp, pointing at something tall — a roster table is easily
 * 4000px — produced a spotlight stretching far above and below the screen,
 * which highlights nothing and leaves the page looking merely dimmed. Clamping
 * means a long list is lit from its header down to the fold, which is the part
 * the reader can actually see.
 */
function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  const top = Math.max(8, r.top - PAD);
  const left = Math.max(8, r.left - PAD);
  const bottom = Math.min(vh - 8, r.bottom + PAD);
  const right = Math.min(vw - 8, r.right + PAD);

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/* --------------------------------------------------------------- tour */

export function Tour({ surface }: { surface: Surface }) {
  const pathname = usePathname();
  const tour = useMemo(() => tourForPath(pathname), [pathname]);

  const [running, setRunning] = useState(false);
  const [offering, setOffering] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);

  // Portal target only exists on the client.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* ---- external starts: the "How this page works" button dispatches this ---- */
  useEffect(() => {
    const onStart = () => {
      setIndex(0);
      setOffering(false);
      setRunning(true);
    };
    window.addEventListener("auf:start-tour", onStart);
    return () => window.removeEventListener("auf:start-tour", onStart);
  }, []);

  /* ---- offer once per page ---- */
  useEffect(() => {
    if (!tour) return;
    let cancelled = false;
    // Deferred so the offer never races the page's first paint, and so the
    // state update is not synchronous inside the effect.
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const offered = readSet(OFFERED_KEY);
      const done = readSet(DONE_KEY);
      if (!offered.has(tour.route) && !done.has(tour.route)) {
        setOffering(true);
      }
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [tour]);

  // Reset when the route changes.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const id = requestAnimationFrame(() => {
      setRunning(false);
      setOffering(false);
      setIndex(0);
      setRect(null);
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Memoised: a fresh [] each render would re-run every hook that depends on it.
  const steps = useMemo(() => tour?.steps ?? [], [tour]);

  /** Index of the next step whose target actually exists, searching forwards. */
  const findUsable = useCallback(
    (from: number, direction: 1 | -1): number => {
      for (let i = from; i >= 0 && i < steps.length; i += direction) {
        const t = steps[i].target;
        if (!t) return i; // centred steps need no target
        const el = document.querySelector(`[data-tour="${t}"]`);
        // Present but collapsed counts as absent. Several targets live inside
        // a tab that is only rendered when selected, or a row that is only
        // rendered when expanded — a zero-size rect would put the spotlight on
        // nothing and leave the card pointing at the corner of the screen.
        if (el && isVisible(el)) return i;
      }
      return -1;
    },
    [steps],
  );

  /* ---- measure the current target ---- */
  useEffect(() => {
    if (!running || !tour) return;
    const step = steps[index];
    if (!step) return;

    if (!step.target) {
      const id = requestAnimationFrame(() => setRect(null));
      return () => cancelAnimationFrame(id);
    }

    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el || !isVisible(el)) {
      const id = requestAnimationFrame(() => setRect(null));
      return () => cancelAnimationFrame(id);
    }

    el.scrollIntoView({ block: "center", behavior: "smooth" });

    let raf = 0;
    const measure = () => setRect(rectOf(el));
    // Give the smooth scroll a moment, then track it.
    const settle = window.setTimeout(() => {
      raf = requestAnimationFrame(measure);
    }, 180);
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.clearTimeout(settle);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [running, index, steps, tour]);

  const finish = useCallback(
    (completed: boolean) => {
      setRunning(false);
      setRect(null);
      setIndex(0);
      if (tour) {
        addTo(OFFERED_KEY, tour.route);
        if (completed) addTo(DONE_KEY, tour.route);
      }
    },
    [tour],
  );

  const go = useCallback(
    (direction: 1 | -1) => {
      const next = findUsable(index + direction, direction);
      if (next === -1) {
        if (direction === 1) finish(true);
        return;
      }
      setIndex(next);
    },
    [index, findUsable, finish],
  );

  /* ---- keyboard ---- */
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, go, finish]);

  if (!tour || !mounted) return null;

  /* ---- the one-time offer ---- */
  if (offering && !running) {
    return createPortal(
      <div className="fixed bottom-4 right-4 z-[80] w-[320px] rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="text-[13px] font-semibold">First time here?</div>
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
          Take a {tour.steps.length}-step tour of {tour.label.toLowerCase()}.
          About a minute.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIndex(findUsable(0, 1));
              setOffering(false);
              setRunning(true);
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
          >
            Show me
          </button>
          <button
            type="button"
            onClick={() => {
              setOffering(false);
              addTo(OFFERED_KEY, tour.route);
            }}
            className="rounded-md px-2 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"
          >
            No thanks
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  if (!running) return null;

  const step = steps[index];
  if (!step) return null;

  return createPortal(
    <TourOverlay
      tour={tour}
      step={step}
      index={index}
      total={steps.length}
      rect={rect}
      surface={surface}
      pathname={pathname}
      onBack={() => go(-1)}
      onNext={() => go(1)}
      onClose={() => finish(false)}
    />,
    document.body,
  );
}

/* ------------------------------------------------------------ overlay */

function TourOverlay({
  tour,
  step,
  index,
  total,
  rect,
  surface,
  pathname,
  onBack,
  onNext,
  onClose,
}: {
  tour: TourDef;
  step: TourDef["steps"][number];
  index: number;
  total: number;
  rect: Rect | null;
  surface: Surface;
  pathname: string;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const isLast = index === total - 1;
  const topic = topicForPath(pathname, surface);

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label={`${tour.label}: step ${index + 1} of ${total}`}
    >
      {/* Spotlight. One box, one very large shadow — everything outside dims. */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-[var(--brand)] transition-all duration-200"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(10, 12, 20, 0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(10,12,20,0.55)]" />
      )}

      {/* Click-catcher: the page stays visible but inert while a tour runs. */}
      <button
        type="button"
        aria-label="Close tour"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />

      <TourCard
        step={step}
        index={index}
        total={total}
        rect={rect}
        isLast={isLast}
        guideHref={
          topic ? `${GUIDE_ROOT[surface]}?topic=${topic.slug}` : GUIDE_ROOT[surface]
        }
        onBack={onBack}
        onNext={onNext}
        onClose={onClose}
      />
    </div>
  );
}

const CARD_W = 340;
const GAP = 14;

/** Position the card beside the spotlight, kept inside the viewport. */
function cardPosition(
  rect: Rect | null,
  placement: TourPlacement | undefined,
): React.CSSProperties {
  if (!rect || placement === "center") {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: CARD_W,
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const place = placement ?? "bottom";

  let top = rect.top + rect.height + GAP;
  let left = rect.left;

  if (place === "top") top = rect.top - GAP - 150;
  if (place === "left") {
    top = rect.top;
    left = rect.left - CARD_W - GAP;
  }
  if (place === "right") {
    top = rect.top;
    left = rect.left + rect.width + GAP;
  }

  // Keep it on screen. A tooltip half off the edge is worse than one that
  // has shuffled a few pixels from its ideal side.
  left = Math.min(Math.max(12, left), vw - CARD_W - 12);
  top = Math.min(Math.max(12, top), vh - 170);

  return { top, left, width: CARD_W };
}

function TourCard({
  step,
  index,
  total,
  rect,
  isLast,
  guideHref,
  onBack,
  onNext,
  onClose,
}: {
  step: TourDef["steps"][number];
  index: number;
  total: number;
  rect: Rect | null;
  isLast: boolean;
  guideHref: string;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Move focus to the card so keyboard users land on the instruction rather
  // than wherever they were on the dimmed page behind it.
  useEffect(() => {
    const id = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [index]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      style={cardPosition(rect, step.placement)}
      className="absolute rounded-xl border border-border bg-card p-4 shadow-2xl outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Step {index + 1} of {total}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tour"
          className="-mr-1 -mt-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <h2 className="mt-1.5 text-[15px] font-semibold leading-snug">
        {step.title}
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
        {step.body}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-4 bg-[var(--brand)]"
                  : i < index
                    ? "w-1.5 bg-[var(--brand)]/40"
                    : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {index > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
          >
            {isLast ? "Done" : "Next"}
            {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {isLast && (
        <Link
          href={guideHref}
          onClick={onClose}
          className="mt-2 inline-block text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Read the full guide for this page
        </Link>
      )}
    </div>
  );
}
