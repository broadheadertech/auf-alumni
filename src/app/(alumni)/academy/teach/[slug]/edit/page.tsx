"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
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
  status: string;
  isMine: boolean;
  lessons: Lesson[];
};

const CATEGORIES = [
  { id: "career", label: "Career" },
  { id: "tech", label: "Tech" },
  { id: "healthcare", label: "Healthcare" },
  { id: "design", label: "Design" },
  { id: "leadership", label: "Leadership" },
  { id: "soft-skills", label: "Soft skills" },
];

const LEVELS = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

const SUMMARY_MAX = 280;
const DESCRIPTION_MAX = 8000;
const ARTICLE_MAX = 20000;

export default function EditCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const course = useQuery(api.academy.getCourseBySlug, { slug }) as
    | Course
    | null
    | undefined;
  const updateCourse = useMutation(api.academy.updateCourse);
  const publishCourse = useMutation(api.academy.publishCourse);
  const unpublishCourse = useMutation(api.academy.unpublishCourse);
  const addLesson = useMutation(api.academy.addLesson);
  const deleteLesson = useMutation(api.academy.deleteLesson);

  // Local form state — hydrated from query when it arrives.
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("career");
  const [level, setLevel] = useState("beginner");
  const [hydrated, setHydrated] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  // Lesson form.
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonKind, setLessonKind] = useState<"video" | "article">("video");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonMarkdown, setLessonMarkdown] = useState("");
  const [lessonDuration, setLessonDuration] = useState("");
  const [addingLesson, setAddingLesson] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Hydrate form once when course arrives. Guarded so user edits aren't
  // clobbered by background refetches on the same slug.
  useEffect(() => {
    if (!hydrated && course) {
      setTitle(course.title);
      setSummary(course.summary);
      setDescription(course.description);
      setCategory(course.category);
      setLevel(course.level);
      setHydrated(true);
    }
  }, [course, hydrated]);

  if (course === undefined) {
    return (
      <div className="mx-auto max-w-[900px] px-4 sm:px-7 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin ink-3" />
      </div>
    );
  }
  if (course === null) {
    return (
      <div className="mx-auto max-w-[900px] px-4 sm:px-7 py-10">
        <EmptyState
          message="Course not found"
          cta={{ label: "Back to your courses", href: "/academy/teach" }}
        />
      </div>
    );
  }
  if (!course.isMine) {
    return (
      <div className="mx-auto max-w-[900px] px-4 sm:px-7 py-10">
        <EmptyState
          message="You don't own this course"
          description="Only the instructor can edit it. You can still view it from the public page."
          cta={{ label: "View course", href: `/academy/${course.slug}` }}
        />
      </div>
    );
  }

  const onSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!summary.trim()) {
      toast.error("Summary is required");
      return;
    }
    setSavingMeta(true);
    try {
      await updateCourse({
        courseId: course._id as Id<"academyCourses">,
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        category,
        level,
      });
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingMeta(false);
    }
  };

  const onTogglePublish = async () => {
    setStatusBusy(true);
    try {
      if (course.status === "published") {
        await unpublishCourse({ courseId: course._id as Id<"academyCourses"> });
        toast.success("Unpublished — moved back to draft");
      } else {
        await publishCourse({ courseId: course._id as Id<"academyCourses"> });
        toast.success("Published — alumni can now enroll");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change status");
    } finally {
      setStatusBusy(false);
    }
  };

  const resetLessonForm = () => {
    setLessonTitle("");
    setLessonVideoUrl("");
    setLessonMarkdown("");
    setLessonDuration("");
  };

  const onAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim()) {
      toast.error("Lesson title is required");
      return;
    }
    if (lessonKind === "video" && !lessonVideoUrl.trim()) {
      toast.error("Video URL is required for video lessons");
      return;
    }
    if (lessonKind === "article" && !lessonMarkdown.trim()) {
      toast.error("Article body is required");
      return;
    }
    const dur = lessonDuration.trim() === "" ? undefined : Number(lessonDuration);
    if (dur !== undefined && (!Number.isFinite(dur) || dur < 0)) {
      toast.error("Duration must be a positive number");
      return;
    }
    setAddingLesson(true);
    try {
      await addLesson({
        courseId: course._id as Id<"academyCourses">,
        title: lessonTitle.trim(),
        kind: lessonKind,
        videoUrl: lessonKind === "video" ? lessonVideoUrl.trim() : undefined,
        articleMarkdown:
          lessonKind === "article" ? lessonMarkdown.trim() : undefined,
        durationMinutes: dur,
      });
      toast.success("Lesson added");
      resetLessonForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add lesson");
    } finally {
      setAddingLesson(false);
    }
  };

  const onDeleteLesson = async (lessonId: string) => {
    if (!window.confirm("Delete this lesson? This can't be undone.")) return;
    setDeletingId(lessonId);
    try {
      await deleteLesson({ lessonId: lessonId as Id<"academyLessons"> });
      toast.success("Lesson deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const isPublished = course.status === "published";
  const canPublish = !isPublished && course.lessons.length > 0;

  return (
    <div className="mx-auto max-w-[900px] px-4 sm:px-7 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/academy/teach"
          className="inline-flex items-center gap-1.5 text-[12.5px] ink-3 hover:ink-2"
        >
          <ArrowLeft size={14} /> Your courses
        </Link>
        <Link
          href={`/academy/${course.slug}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] brand-fg hover:underline"
        >
          View public page <ExternalLink size={12} />
        </Link>
      </div>

      <div className="mb-6">
        <div className="section-eyebrow mb-1">Editing course</div>
        <h1 className="font-serif text-[28px] font-semibold leading-tight">
          {course.title}
        </h1>
      </div>

      {/* Status / publish */}
      <div className="auf-card mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="section-eyebrow mb-1">Status</div>
          <div className="flex items-center gap-2">
            <span
              className={`auf-chip ${
                isPublished ? "auf-chip-verified" : "auf-chip-gold"
              }`}
            >
              {isPublished ? "Published" : "Draft"}
            </span>
            <span className="text-[12px] ink-3">
              {isPublished
                ? "Alumni can find and enroll in this course."
                : course.lessons.length === 0
                ? "Add at least one lesson before publishing."
                : "Ready to publish whenever you are."}
            </span>
          </div>
        </div>
        <button
          onClick={onTogglePublish}
          disabled={statusBusy || (!isPublished && !canPublish)}
          className={`auf-btn ${isPublished ? "auf-btn-outline" : "auf-btn-primary"}`}
        >
          {statusBusy ? (
            <>
              <Loader2 size={14} className="animate-spin" />{" "}
              {isPublished ? "Unpublishing…" : "Publishing…"}
            </>
          ) : isPublished ? (
            "Unpublish"
          ) : (
            "Publish"
          )}
        </button>
      </div>

      {/* Meta editor */}
      <form onSubmit={onSaveMeta} className="auf-card mb-5 space-y-5 p-5 sm:p-6">
        <div className="section-eyebrow">Course details</div>

        <div>
          <label className="mb-1 block text-[13px] font-medium ink-2">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="auf-input"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium ink-2">
            One-line summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={SUMMARY_MAX}
            rows={2}
            className="auf-input resize-y"
            required
          />
          <div className="mt-1 text-right text-[11px] ink-3">
            {summary.length}/{SUMMARY_MAX}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium ink-2">
            Full description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={6}
            className="auf-input resize-y"
          />
          <div className="mt-1 text-right text-[11px] ink-3">
            {description.length}/{DESCRIPTION_MAX}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[13px] font-medium ink-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="auf-input"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium ink-2">
              Level
            </span>
            <div className="flex flex-wrap gap-3">
              {LEVELS.map((l) => (
                <label
                  key={l.id}
                  className="inline-flex cursor-pointer items-center gap-2 text-[13.5px]"
                >
                  <input
                    type="radio"
                    name="level"
                    value={l.id}
                    checked={level === l.id}
                    onChange={() => setLevel(l.id)}
                    className="h-4 w-4"
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="auf-hairline flex justify-end border-t pt-4">
          <button
            type="submit"
            disabled={savingMeta}
            className="auf-btn auf-btn-primary"
          >
            {savingMeta ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </form>

      {/* Lessons */}
      <div className="auf-card mb-5 p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="section-eyebrow">Lessons</div>
            <p className="mt-0.5 text-[12.5px] ink-3">
              {course.lessons.length} lesson
              {course.lessons.length === 1 ? "" : "s"} in this course
            </p>
          </div>
        </div>

        {course.lessons.length === 0 ? (
          <p className="text-[13px] ink-3">No lessons yet. Add one below.</p>
        ) : (
          <ol className="space-y-2">
            {course.lessons.map((l) => {
              const Icon = l.kind === "article" ? FileText : Play;
              return (
                <li
                  key={l._id}
                  className="auf-hairline flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[12px] font-semibold ink-2">
                    {l.order}
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
                        <span>{l.durationMinutes} min</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteLesson(l._id)}
                    disabled={deletingId === l._id}
                    className="auf-btn auf-btn-outline auf-btn-sm"
                    title="Delete lesson"
                  >
                    {deletingId === l._id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Add lesson */}
      <form onSubmit={onAddLesson} className="auf-card space-y-4 p-5 sm:p-6">
        <div className="section-eyebrow">Add a lesson</div>

        <div>
          <label className="mb-1 block text-[13px] font-medium ink-2">
            Lesson title
          </label>
          <input
            type="text"
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Setting your minimum acceptable number"
            className="auf-input"
            required
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium ink-2">
            Lesson type
          </span>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px]">
              <input
                type="radio"
                name="lessonKind"
                value="video"
                checked={lessonKind === "video"}
                onChange={() => setLessonKind("video")}
                className="h-4 w-4"
              />
              <Play size={14} /> Video
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px]">
              <input
                type="radio"
                name="lessonKind"
                value="article"
                checked={lessonKind === "article"}
                onChange={() => setLessonKind("article")}
                className="h-4 w-4"
              />
              <FileText size={14} /> Article
            </label>
          </div>
        </div>

        {lessonKind === "video" ? (
          <div>
            <label className="mb-1 block text-[13px] font-medium ink-2">
              Video embed URL
            </label>
            <input
              type="url"
              value={lessonVideoUrl}
              onChange={(e) => setLessonVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/embed/..."
              className="auf-input"
            />
            <p className="mt-1 text-[11.5px] ink-3">
              Use the embed URL (e.g. YouTube's <code>/embed/&lt;id&gt;</code>).
            </p>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-[13px] font-medium ink-2">
              Article body (markdown)
            </label>
            <textarea
              value={lessonMarkdown}
              onChange={(e) => setLessonMarkdown(e.target.value)}
              maxLength={ARTICLE_MAX}
              rows={8}
              placeholder="Write the lesson. Use **bold**, *italic*, and double newlines for paragraphs."
              className="auf-input resize-y"
            />
            <div className="mt-1 text-right text-[11px] ink-3">
              {lessonMarkdown.length}/{ARTICLE_MAX}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-[13px] font-medium ink-2">
            Estimated duration (minutes, optional)
          </label>
          <input
            type="number"
            min={0}
            value={lessonDuration}
            onChange={(e) => setLessonDuration(e.target.value)}
            placeholder="e.g. 12"
            className="auf-input"
          />
        </div>

        <div className="auf-hairline flex justify-end border-t pt-4">
          <button
            type="submit"
            disabled={addingLesson}
            className="auf-btn auf-btn-primary"
          >
            {addingLesson ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Adding…
              </>
            ) : (
              <>
                <Plus size={14} /> Add lesson
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
