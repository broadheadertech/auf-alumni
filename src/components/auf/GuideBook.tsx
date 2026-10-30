"use client";

/**
 * The guide reader, shared by all three surfaces.
 *
 * Built to be used two ways, because those are the two moments people need it:
 *   - as a guided walkthrough, read top to bottom on day one
 *   - as a refresher, opened at one topic from the page you're stuck on
 *     (/guide?topic=jobs), which is why every topic is individually linkable
 *
 * Read topics are ticked off in localStorage, so coming back shows you what
 * you've already covered. That's a per-browser convenience only — it is never
 * read back by the server and the page works fine when storage is unavailable.
 */

import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Lightbulb,
  Printer,
  Search,
  X,
} from "lucide-react";
import {
  SURFACE_INTRO,
  SURFACE_LABEL,
  groupsFor,
  topicsFor,
  type GuideTopic,
  type Surface,
} from "@/lib/guide/content";
import {
  getReadServerSnapshot,
  getReadSnapshot,
  parseRead,
  subscribeReadProgress,
  toggleRead,
} from "@/lib/guide/read-progress";
import { cn } from "@/lib/utils";

export function GuideBook({ surface }: { surface: Surface }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm ink-3">Loading the guide…</div>}>
      <GuideBookRouted surface={surface} />
    </Suspense>
  );
}

/**
 * Remounts the reader when ?topic= changes, so the requested topic becomes the
 * initial open state instead of an effect correcting it after the fact.
 */
function GuideBookRouted({ surface }: { surface: Surface }) {
  const params = useSearchParams();
  const requested = params.get("topic");
  return <GuideBookInner key={requested ?? ""} surface={surface} requested={requested} />;
}

function GuideBookInner({
  surface,
  requested,
}: {
  surface: Surface;
  requested: string | null;
}) {
  const topics = useMemo(() => topicsFor(surface), [surface]);
  const groups = useMemo(() => groupsFor(surface), [surface]);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(requested);

  const doneRaw = useSyncExternalStore(
    subscribeReadProgress,
    getReadSnapshot,
    getReadServerSnapshot,
  );
  const done = useMemo(() => parseRead(doneRaw), [doneRaw]);

  // Deep link: scroll the requested topic into view once it has rendered.
  // It is already open — the key on this component made it the initial state.
  useEffect(() => {
    if (!requested) return;
    const id = window.setTimeout(() => {
      document.getElementById(`topic-${requested}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
    return () => window.clearTimeout(id);
  }, [requested]);

  const toggleDone = useCallback((slug: string) => toggleRead(slug), []);

  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return topics;
    return topics.filter((t) =>
      [t.tab, t.purpose, t.group, ...t.steps, ...(t.tips ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [topics, needle]);

  const readCount = topics.filter((t) => done.includes(t.slug)).length;

  return (
    <div className="mx-auto max-w-[840px] px-4 py-8 sm:px-7 sm:py-10">
      <div className="section-eyebrow brand-fg">{SURFACE_LABEL[surface]}</div>
      <h1 className="mt-2 font-serif text-[30px] font-semibold leading-tight sm:text-[38px]">
        How to use the system
      </h1>
      <p className="mt-3 max-w-[64ch] text-[15px] ink-2">{SURFACE_INTRO[surface]}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-[360px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the guide…"
            aria-label="Search the guide"
            className="w-full rounded-md border border-[var(--border-soft)] bg-transparent py-2 pl-9 pr-8 text-[14px] outline-none focus:border-[var(--brand)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 ink-3 hover:ink"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <span className="text-[12.5px] ink-3">
          {readCount} of {topics.length} read
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="auf-btn auf-btn-ghost auf-btn-sm ml-auto"
          title="Print this guide"
        >
          <Printer size={13} /> Print
        </button>
      </div>

      {needle && (
        <p className="mt-4 text-[13px] ink-3">
          {matches.length === 0
            ? "Nothing in the guide matches that."
            : `${matches.length} walkthrough${matches.length === 1 ? "" : "s"} match “${query.trim()}”.`}
        </p>
      )}

      <div className="mt-6 space-y-8">
        {groups.map((group) => {
          const inGroup = matches.filter((t) => t.group === group);
          if (inGroup.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="section-eyebrow mb-2">{group}</h2>
              <div className="space-y-2">
                {inGroup.map((topic) => (
                  <TopicCard
                    key={topic.slug}
                    topic={topic}
                    expanded={open === topic.slug || !!needle}
                    onToggle={() => setOpen(open === topic.slug ? null : topic.slug)}
                    done={done.includes(topic.slug)}
                    onDone={() => toggleDone(topic.slug)}
                    onJump={(slug) => setOpen(slug)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TopicCard({
  topic,
  expanded,
  onToggle,
  done,
  onDone,
  onJump,
}: {
  topic: GuideTopic;
  expanded: boolean;
  onToggle: () => void;
  done: boolean;
  onDone: () => void;
  onJump: (slug: string) => void;
}) {
  return (
    <div id={`topic-${topic.slug}`} className="auf-card scroll-mt-20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-[var(--surface-2)]"
      >
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
            done
              ? "border-[var(--brand)] brand-50 brand-fg"
              : "border-[var(--border-soft)] ink-3",
          )}
          aria-hidden
        >
          {done ? <Check size={11} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{topic.tab}</span>
          <span className="mt-0.5 block text-[13px] ink-2">{topic.purpose}</span>
        </span>
        <ChevronDown
          size={16}
          className={cn("mt-1 shrink-0 ink-3 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="border-t auf-hairline px-4 pb-4 pt-4">
          <ol className="space-y-2.5">
            {topic.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold ink-2">
                  {i + 1}
                </span>
                <span className="text-[14px] leading-[1.6] ink-2">{step}</span>
              </li>
            ))}
          </ol>

          {topic.tips && topic.tips.length > 0 && (
            <div className="mt-4 rounded-md bg-[var(--surface-2)] p-3">
              <div className="section-eyebrow mb-1.5 flex items-center gap-1.5">
                <Lightbulb size={11} /> Worth knowing
              </div>
              <ul className="space-y-1.5">
                {topic.tips.map((tip) => (
                  <li key={tip} className="flex gap-2 text-[13px] leading-[1.55] ink-2">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--brand)]" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={topic.href} className="auf-btn auf-btn-primary auf-btn-sm">
              Open {topic.tab} <ArrowRight size={12} />
            </Link>
            <button
              type="button"
              onClick={onDone}
              className="auf-btn auf-btn-outline auf-btn-sm"
            >
              {done ? "Mark unread" : "Mark as read"}
            </button>
            {topic.seeAlso?.map((slug) => {
              const other = topicsFor(topic.surface).find((t) => t.slug === slug);
              if (!other) return null;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => {
                    onJump(slug);
                    document
                      .getElementById(`topic-${slug}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="auf-chip text-[11.5px] hover:border-[var(--brand)]"
                >
                  {other.tab}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
