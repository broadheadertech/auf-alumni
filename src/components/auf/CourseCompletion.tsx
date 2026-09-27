"use client";

/**
 * "You finished the course" panel — the next steps after the last lesson.
 *
 * Completion used to be a dead end: the final lesson just said "Completed"
 * with nothing to do next. This offers the obvious moves — tell the network,
 * talk to the instructor, and pick the next course.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ArrowRight, Award, BookOpen, Briefcase, Check, Loader2, MessageCircle, Share2, Sparkles } from "lucide-react";
import { api } from "@/lib/convex-api";
import { cn } from "@/lib/utils";

export type NextCourse = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: string;
  sameCategory: boolean;
};

export function CourseCompletion({
  courseTitle,
  instructorName,
  instructorId,
  instructorSlug,
  instructorOpenTo,
  completedAt,
  nextCourses,
  className,
}: {
  courseTitle: string;
  instructorName: string;
  instructorId: string;
  instructorSlug: string | null;
  instructorOpenTo: string[];
  completedAt: number | null;
  nextCourses: NextCourse[];
  className?: string;
}) {
  const publishPost = useMutation(api.feed.publishPost);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const mentors = instructorOpenTo.some((t) => t.toLowerCase().includes("mentor"));
  const firstName = instructorName.split(" ")[0];

  const share = async () => {
    setSharing(true);
    try {
      await publishPost({
        content: `Just finished “${courseTitle}” on AUF Academy — taught by ${instructorName}. Happy to answer questions from anyone thinking of taking it.`,
        visibilityTier: "alumni",
      });
      setShared(true);
      toast.success("Shared with the alumni feed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not share");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className={cn("auf-card p-5 sm:p-6", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full brand-50 brand-fg">
          <Award size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-[20px] font-semibold leading-tight">
            Course complete
          </h2>
          <p className="mt-1 text-[13.5px] ink-2">
            You finished every lesson in “{courseTitle}”
            {completedAt
              ? ` on ${new Date(completedAt).toLocaleDateString("en-PH", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`
              : ""}
            . Here is what alumni usually do next.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={share}
          disabled={sharing || shared}
          className={`auf-btn auf-btn-sm ${shared ? "auf-btn-outline" : "auf-btn-primary"}`}
        >
          {shared ? (
            <>
              <Check size={13} /> Shared to your feed
            </>
          ) : sharing ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Sharing…
            </>
          ) : (
            <>
              <Share2 size={13} /> Share with the network
            </>
          )}
        </button>
        <Link href={`/messages?to=${instructorId}`} className="auf-btn auf-btn-outline auf-btn-sm">
          <MessageCircle size={13} /> Ask {firstName} a question
        </Link>
        {mentors && (
          <Link href="/mentorship" className="auf-btn auf-btn-outline auf-btn-sm">
            <Sparkles size={13} /> Request mentorship
          </Link>
        )}
        {instructorSlug && (
          <Link href={`/profile/${instructorSlug}`} className="auf-btn auf-btn-ghost auf-btn-sm">
            View {firstName}&apos;s profile
          </Link>
        )}
        <Link href="/jobs" className="auf-btn auf-btn-ghost auf-btn-sm">
          <Briefcase size={13} /> Put it to work — see jobs
        </Link>
      </div>

      <div className="auf-hairline mt-5 border-t pt-4">
        <div className="section-eyebrow mb-2 flex items-center gap-1.5">
          <BookOpen size={12} /> Keep going
        </div>
        {nextCourses.length === 0 ? (
          <p className="text-[13px] ink-3">
            That is every course published so far.{" "}
            <Link href="/academy/teach" className="brand-fg hover:underline">
              Teach one yourself
            </Link>{" "}
            — you have just proven you finish what you start.
          </p>
        ) : (
          <div className="space-y-2">
            {nextCourses.map((c) => (
              <Link
                key={c.slug}
                href={`/academy/${c.slug}`}
                className="flex items-start gap-3 rounded-lg border border-[var(--border-soft)] p-3 transition-colors hover:border-[var(--brand)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-medium">{c.title}</span>
                    {c.sameCategory && (
                      <span className="auf-chip auf-chip-brand text-[10px]">
                        Same topic
                      </span>
                    )}
                    <span className="auf-chip text-[10px] capitalize">{c.level}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] ink-3">{c.summary}</p>
                </div>
                <ArrowRight size={14} className="mt-1 shrink-0 ink-3" />
              </Link>
            ))}
          </div>
        )}
        <Link
          href="/academy"
          className="mt-3 inline-flex items-center gap-1 text-[12.5px] brand-fg hover:underline"
        >
          Browse all courses <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
