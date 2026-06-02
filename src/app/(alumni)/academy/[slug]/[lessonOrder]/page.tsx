"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
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
  lessons: Lesson[];
  enrollment: { _id: string; completedLessonIds: string[] } | null;
};

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
      className="mb-4 text-[15px] leading-[1.7] ink"
      dangerouslySetInnerHTML={{ __html: inline(para) }}
    />
  ));
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonOrder: string }>;
}) {
  const { slug, lessonOrder } = use(params);
  const order = parseInt(lessonOrder, 10);
  const course = useQuery(api.academy.getCourseBySlug, { slug }) as
    | Course
    | null
    | undefined;
  const markComplete = useMutation(api.academy.markLessonComplete);
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
          cta={{ label: "Back to AUF Academy", href: "/academy" }}
        />
      </div>
    );
  }

  const lesson = course.lessons.find((l) => l.order === order);
  if (!lesson || Number.isNaN(order)) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-10">
        <EmptyState
          message="Lesson not found"
          description="This lesson may have been removed."
          cta={{ label: "Back to course", href: `/academy/${course.slug}` }}
        />
      </div>
    );
  }

  const completedSet = new Set(course.enrollment?.completedLessonIds ?? []);
  const isComplete = completedSet.has(lesson._id);
  const prev = course.lessons.find((l) => l.order === order - 1);
  const next = course.lessons.find((l) => l.order === order + 1);

  const onMark = async () => {
    if (!course.enrollment) {
      toast.error("Enroll in the course first");
      return;
    }
    setBusy(true);
    try {
      await markComplete({
        courseId: course._id as Id<"academyCourses">,
        lessonId: lesson._id as Id<"academyLessons">,
      });
      toast.success("Lesson complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={`/academy/${course.slug}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] ink-3 hover:ink-2"
        >
          <ArrowLeft size={14} /> {course.title}
        </Link>
        <div className="flex items-center gap-2 text-[12.5px]">
          {prev && (
            <Link
              href={`/academy/${course.slug}/${prev.order}`}
              className="auf-btn auf-btn-outline auf-btn-sm"
            >
              <ArrowLeft size={12} /> Prev
            </Link>
          )}
          {next && (
            <Link
              href={`/academy/${course.slug}/${next.order}`}
              className="auf-btn auf-btn-outline auf-btn-sm"
            >
              Next <ArrowRight size={12} />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="auf-card p-5 sm:p-6">
            <div className="mb-3">
              <div className="section-eyebrow">
                Lesson {lesson.order} of {course.lessons.length}
              </div>
              <h1 className="mt-1 font-serif text-[24px] font-semibold leading-tight sm:text-[28px]">
                {lesson.title}
              </h1>
            </div>

            {lesson.kind === "video" && lesson.videoUrl ? (
              <iframe
                src={lesson.videoUrl}
                className="aspect-video w-full rounded-lg border border-[var(--border-soft)]"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : lesson.kind === "article" && lesson.articleMarkdown ? (
              <div className="mx-auto max-w-[720px] py-2">
                {renderMarkdown(lesson.articleMarkdown)}
              </div>
            ) : (
              <p className="text-[13.5px] ink-3">
                This lesson has no content yet.
              </p>
            )}

            <div className="auf-hairline mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <button
                onClick={onMark}
                disabled={busy || isComplete || !course.enrollment}
                className={`auf-btn ${isComplete ? "auf-btn-outline" : "auf-btn-primary"}`}
              >
                {isComplete ? (
                  <>
                    <Check size={14} /> Completed
                  </>
                ) : busy ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </>
                ) : (
                  "Mark complete"
                )}
              </button>
              {!course.enrollment && (
                <span className="text-[12px] ink-3">
                  Enroll on the course page to track progress.
                </span>
              )}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="auf-card p-5">
            <div className="section-eyebrow mb-3">Course outline</div>
            <ol className="space-y-1">
              {course.lessons.map((l) => {
                const done = completedSet.has(l._id);
                const current = l.order === order;
                return (
                  <li key={l._id}>
                    <Link
                      href={`/academy/${course.slug}/${l.order}`}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] transition ${
                        current
                          ? "brand-50 brand-fg font-medium"
                          : "ink-2 hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] ${
                          done
                            ? "brand-bg text-white"
                            : "bg-[var(--surface-2)] ink-3"
                        }`}
                      >
                        {done ? <Check size={11} /> : l.order}
                      </span>
                      <span className="truncate">{l.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
