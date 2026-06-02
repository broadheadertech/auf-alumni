"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  FileText,
  Loader2,
  Play,
  Users,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { AUFAvatar } from "@/components/auf/AUFAvatar";
import { EmptyState } from "@/components/auf/EmptyState";

type Lesson = {
  _id: string;
  order: number;
  title: string;
  kind: "video" | "article" | string;
  videoUrl: string | null;
  articleMarkdown: string | null;
  durationMinutes: number | null;
};

type Course = {
  _id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  level: string;
  durationMinutes: number | null;
  status: string;
  publishedAt: number | null;
  coverImageUrl: string | null;
  instructorId: string;
  isMine: boolean;
  instructorName: string;
  instructorSlug: string | null;
  instructorBatch: number | null;
  instructorProgram: string | null;
  instructorOpenTo: string[];
  lessons: Lesson[];
  enrolledCount: number;
  enrollment: { _id: string; completedLessonIds: string[] } | null;
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Tiny markdown renderer: paragraphs, bold, italic, line breaks.
function renderMarkdown(md: string): React.ReactNode {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, "$1<em>$2</em>")
      .replace(/\n/g, "<br/>");
  return md.split(/\n{2,}/).map((para, i) => (
    <p
      key={i}
      className="mb-3 text-[14.5px] leading-[1.65] ink"
      dangerouslySetInnerHTML={{ __html: inline(para) }}
    />
  ));
}

function gradFor(seed: string): 1 | 2 | 3 | 4 | 5 | 6 {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const course = useQuery(api.academy.getCourseBySlug, { slug }) as
    | Course
    | null
    | undefined;
  const enroll = useMutation(api.academy.enroll);
  const [busy, setBusy] = useState(false);

  if (course === undefined) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin ink-3" />
      </div>
    );
  }
  if (course === null) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-10">
        <EmptyState
          message="Course not found"
          description="This course may have been unpublished or removed."
          cta={{ label: "Back to AUF Academy", href: "/academy" }}
        />
      </div>
    );
  }

  const grad = gradFor(course.slug);
  const glyph = course.title.charAt(0).toUpperCase();
  const completedSet = new Set(course.enrollment?.completedLessonIds ?? []);
  const completedCount = course.enrollment
    ? course.lessons.filter((l) => completedSet.has(l._id)).length
    : 0;
  const totalLessons = course.lessons.length;
  const progressPct =
    totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
  const totalDuration =
    course.durationMinutes ??
    course.lessons.reduce((acc, l) => acc + (l.durationMinutes ?? 0), 0);

  const onEnroll = async () => {
    setBusy(true);
    try {
      await enroll({ courseId: course._id as Id<"academyCourses"> });
      toast.success("Enrolled — you're in!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enroll failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-6">
      <Link
        href="/academy"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] ink-3 hover:ink-2"
      >
        <ArrowLeft size={14} /> Back to AUF Academy
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="auf-card overflow-hidden">
            <div className="relative h-[200px] w-full sm:h-[280px]">
              {course.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.coverImageUrl}
                  alt={course.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  className={`av-grad-${grad} flex h-full w-full items-center justify-center font-serif text-7xl font-semibold text-white`}
                >
                  {glyph}
                </div>
              )}
            </div>
            <div className="space-y-3 p-5 sm:p-6">
              <div className="flex flex-wrap gap-1.5">
                <span className="auf-chip auf-chip-brand">
                  {titleCase(course.level)}
                </span>
                <span className="auf-chip">{titleCase(course.category)}</span>
                {totalDuration > 0 && (
                  <span className="auf-chip">
                    <Clock size={11} /> ~{totalDuration} min total
                  </span>
                )}
                {course.status !== "published" && course.isMine && (
                  <span className="auf-chip auf-chip-gold">
                    Draft — not published
                  </span>
                )}
              </div>
              <h1 className="font-serif text-[28px] font-semibold leading-tight sm:text-[32px]">
                {course.title}
              </h1>
              <p className="text-[14.5px] italic leading-[1.6] ink-2">
                {course.summary}
              </p>
            </div>
          </div>

          {course.description.trim().length > 0 && (
            <div className="auf-card p-6">
              <h2 className="mb-3 font-serif text-[18px] font-semibold">
                About this course
              </h2>
              <div className="whitespace-pre-wrap">
                {renderMarkdown(course.description)}
              </div>
            </div>
          )}

          <div className="auf-card p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-[18px] font-semibold">Lessons</h2>
              <span className="text-[12px] ink-3">
                {totalLessons} lesson{totalLessons === 1 ? "" : "s"}
              </span>
            </div>
            {totalLessons === 0 ? (
              <p className="text-[13.5px] ink-3">
                No lessons yet — check back soon.
              </p>
            ) : (
              <ol className="space-y-2">
                {course.lessons.map((l) => {
                  const done = completedSet.has(l._id);
                  const Icon = l.kind === "article" ? FileText : Play;
                  return (
                    <li key={l._id}>
                      <Link
                        href={`/academy/${course.slug}/${l.order}`}
                        className="auf-hairline group flex items-center gap-3 rounded-lg border p-3 transition hover:bg-[var(--surface-2)]"
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                            done
                              ? "brand-bg text-white"
                              : "bg-[var(--surface-2)] ink-2"
                          }`}
                        >
                          {done ? <Check size={14} /> : l.order}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium ink">
                            {l.title}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] ink-3">
                            <span className="inline-flex items-center gap-1">
                              <Icon size={11} />
                              {l.kind === "article" ? "Article" : "Video"}
                            </span>
                            {l.durationMinutes != null && (
                              <span className="inline-flex items-center gap-1">
                                <Clock size={11} />
                                {l.durationMinutes} min
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div className="auf-card p-5">
            {course.enrollment ? (
              <>
                <div className="section-eyebrow mb-1">Your progress</div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-serif text-[20px] font-semibold">
                    {completedCount}/{totalLessons}
                  </span>
                  <span className="text-[11.5px] ink-3">{progressPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full brand-bg transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {totalLessons > 0 && (
                  <Link
                    href={`/academy/${course.slug}/${
                      course.lessons.find((l) => !completedSet.has(l._id))
                        ?.order ?? 1
                    }`}
                    className="auf-btn auf-btn-primary mt-4 w-full justify-center"
                  >
                    {completedCount === 0
                      ? "Start course"
                      : completedCount === totalLessons
                      ? "Review course"
                      : "Continue learning"}
                  </Link>
                )}
              </>
            ) : (
              <>
                <div className="section-eyebrow mb-2">Free for alumni</div>
                <p className="mb-3 text-[13px] ink-2">
                  Enroll to track your progress and unlock the lessons.
                </p>
                <button
                  onClick={onEnroll}
                  disabled={busy || course.status !== "published"}
                  className="auf-btn auf-btn-primary w-full justify-center"
                >
                  {busy ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Enrolling…
                    </>
                  ) : (
                    "Enroll free"
                  )}
                </button>
                {course.status !== "published" && (
                  <p className="mt-2 text-[11.5px] ink-3">
                    Available once the instructor publishes.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="auf-card p-5">
            <div className="section-eyebrow mb-3">Instructor</div>
            <div className="flex items-center gap-3">
              <AUFAvatar name={course.instructorName} grad={1} badge size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium ink">
                  {course.instructorName}
                </div>
                <div className="truncate text-[11.5px] ink-3">
                  {course.instructorBatch
                    ? `'${String(course.instructorBatch).slice(-2)}`
                    : ""}
                  {course.instructorBatch && course.instructorProgram ? " · " : ""}
                  {course.instructorProgram ?? ""}
                </div>
              </div>
            </div>
            {course.isMine ? (
              <Link
                href={`/academy/teach/${course.slug}/edit`}
                className="brand-fg mt-3 inline-block text-[13px] hover:underline"
              >
                Edit course →
              </Link>
            ) : course.instructorOpenTo.includes("Mentorship") &&
              course.instructorSlug ? (
              <Link
                href={`/mentorship?mentor=${encodeURIComponent(course.instructorSlug)}`}
                className="brand-fg mt-3 inline-block text-[13px] hover:underline"
              >
                Request 1:1 mentorship →
              </Link>
            ) : null}
          </div>

          <div className="auf-card p-5">
            <div className="section-eyebrow mb-3">At a glance</div>
            <div className="space-y-2 text-[13px] ink-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 ink-3">
                  <Users size={13} /> Enrolled
                </span>
                <span className="font-medium ink">{course.enrolledCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 ink-3">
                  <BookOpen size={13} /> Lessons
                </span>
                <span className="font-medium ink">{totalLessons}</span>
              </div>
              {totalDuration > 0 && (
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 ink-3">
                    <Clock size={13} /> Duration
                  </span>
                  <span className="font-medium ink">~{totalDuration} min</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
