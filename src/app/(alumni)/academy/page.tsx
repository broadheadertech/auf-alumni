"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { BookOpen, CheckCircle2, Loader2, Plus } from "lucide-react";
import { api } from "@/lib/convex-api";

type GradKey = 1 | 2 | 3 | 4 | 5 | 6;

type Course = {
  _id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: string;
  durationMinutes: number | null;
  coverImageUrl: string | null;
  publishedAt: number | null;
  instructorName: string;
  instructorSlug: string | null;
  instructorBatch: number | null;
  instructorProgram: string | null;
  enrolledCount: number;
};

type MyCourse = {
  courseId: string;
  progress: number;
  completedAt: number | null;
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "career", label: "Career" },
  { id: "tech", label: "Tech" },
  { id: "healthcare", label: "Healthcare" },
  { id: "design", label: "Design" },
  { id: "leadership", label: "Leadership" },
];

const LEVELS = [
  { id: "all", label: "All levels" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

function gradFor(seed: string): GradKey {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (((Math.abs(h) % 6) + 1) as GradKey);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AcademyBrowsePage() {
  const [category, setCategory] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");

  const queryArgs: { category?: string; level?: string } = {};
  if (category !== "all") queryArgs.category = category;
  if (level !== "all") queryArgs.level = level;

  const courses = useQuery(api.academy.listPublished, queryArgs);
  const list = (courses ?? []) as Course[];

  // My enrolled courses → progress/completion keyed by courseId, for the badges.
  const myCourses = useQuery(api.academy.myCourses) as MyCourse[] | null | undefined;
  const enrollmentByCourse = useMemo(() => {
    const m = new Map<string, MyCourse>();
    for (const e of myCourses ?? []) m.set(e.courseId, e);
    return m;
  }, [myCourses]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="section-eyebrow mb-1">
            How-to courses from verified alumni
          </div>
          <h1 className="font-serif text-[28px] sm:text-[32px] font-semibold leading-tight">
            AUF Academy
          </h1>
        </div>
        <Link href="/academy/teach" className="auf-btn auf-btn-primary">
          <Plus size={15} /> Teach a course
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`auf-chip ${active ? "auf-chip-brand" : ""}`}
                aria-pressed={active}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => {
            const active = level === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`auf-chip ${active ? "auf-chip-brand" : ""}`}
                aria-pressed={active}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        {courses === undefined ? (
          <Loader2 className="mx-auto mt-12 h-6 w-6 animate-spin ink-3" />
        ) : list.length === 0 ? (
          <div className="auf-card brand-50 mx-auto max-w-xl p-8 text-center">
            <h3 className="font-serif text-[18px] font-semibold">
              No courses yet in this slice
            </h3>
            <p className="mt-1.5 text-[13.5px] ink-2">
              Be the first to share your expertise with fellow alumni.
            </p>
            <Link
              href="/academy/teach"
              className="auf-btn auf-btn-primary mt-4 inline-flex"
            >
              <Plus size={14} /> Teach a course
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => {
              const grad = gradFor(c.slug);
              const glyph = c.title.charAt(0).toUpperCase();
              const mine = enrollmentByCourse.get(c._id);
              return (
                <Link
                  key={c._id}
                  href={`/academy/${c.slug}`}
                  className="auf-card group flex flex-col overflow-hidden transition hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    {c.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.coverImageUrl}
                        alt={c.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`av-grad-${grad} flex h-full w-full items-center justify-center font-serif text-5xl font-semibold text-white`}
                      >
                        {glyph}
                      </div>
                    )}
                    {mine && <CourseBadge enrollment={mine} />}
                    {mine && !mine.completedAt && mine.progress > 0 && (
                      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/25">
                        <div
                          className="h-full brand-bg transition-all"
                          style={{ width: `${mine.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="auf-chip auf-chip-brand">
                        {titleCase(c.level)}
                      </span>
                      <span className="auf-chip">{titleCase(c.category)}</span>
                    </div>
                    <h3 className="font-serif text-[18px] font-semibold leading-snug">
                      {c.title}
                    </h3>
                    <p className="line-clamp-3 text-[13px] leading-[1.5] ink-2">
                      {c.summary}
                    </p>
                    <div className="auf-hairline mt-auto flex items-center justify-between gap-2 border-t pt-3 text-[11.5px] ink-3">
                      <span className="truncate">
                        {c.instructorName}
                        {c.instructorBatch ? ` · '${String(c.instructorBatch).slice(-2)}` : ""}
                        {c.instructorProgram ? ` · ${c.instructorProgram}` : ""}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <BookOpen size={11} /> {c.enrolledCount} enrolled
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Completion / progress badge overlaid on an enrolled course's cover. */
function CourseBadge({ enrollment }: { enrollment: MyCourse }) {
  if (enrollment.completedAt) {
    return (
      <span
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
        style={{ background: "var(--gold-ink, #8a6d1a)" }}
      >
        <CheckCircle2 size={12} /> Completed
      </span>
    );
  }
  const label = enrollment.progress > 0 ? `${enrollment.progress}% done` : "Enrolled";
  return (
    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
      {label}
    </span>
  );
}
