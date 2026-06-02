"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft, BookOpen, Loader2, Plus, Users } from "lucide-react";
import { api } from "@/lib/convex-api";

type InstructorCourse = {
  _id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: string;
  status: string;
  lessonCount: number;
  enrolledCount: number;
  updatedAt: number;
  publishedAt: number | null;
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TeachDashboardPage() {
  const courses = useQuery(api.academy.myInstructorCourses) as
    | InstructorCourse[]
    | null
    | undefined;

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-6 sm:py-8">
      <Link
        href="/academy"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] ink-3 hover:ink-2"
      >
        <ArrowLeft size={14} /> Back to AUF Academy
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="section-eyebrow mb-1">Instructor dashboard</div>
          <h1 className="font-serif text-[28px] sm:text-[32px] font-semibold leading-tight">
            Teach on AUF Academy
          </h1>
          <p className="mt-2 max-w-xl text-[14px] ink-2">
            Package what you know into a short course. Lessons can be videos or
            written articles — publish when you have at least one.
          </p>
        </div>
        <Link href="/academy/teach/new" className="auf-btn auf-btn-primary">
          <Plus size={15} /> Create a course
        </Link>
      </div>

      <div className="mt-8">
        {courses === undefined ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin ink-3" />
        ) : !courses || courses.length === 0 ? (
          <div className="auf-card brand-50 mx-auto max-w-xl p-8 text-center">
            <h3 className="font-serif text-[20px] font-semibold">
              You haven't created a course yet
            </h3>
            <p className="mt-2 text-[13.5px] ink-2">
              Share a practical skill — career tips, healthcare workflows,
              design patterns, leadership lessons. Your fellow alumni will
              benefit.
            </p>
            <Link
              href="/academy/teach/new"
              className="auf-btn auf-btn-primary mt-4 inline-flex"
            >
              <Plus size={14} /> Create your first course
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((c) => (
              <Link
                key={c._id}
                href={`/academy/teach/${c.slug}/edit`}
                className="auf-card flex flex-col gap-3 p-5 transition hover:shadow-md sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    <span
                      className={`auf-chip ${
                        c.status === "published" ? "auf-chip-verified" : "auf-chip-gold"
                      }`}
                    >
                      {c.status === "published" ? "Published" : "Draft"}
                    </span>
                    <span className="auf-chip auf-chip-brand">
                      {titleCase(c.level)}
                    </span>
                    <span className="auf-chip">{titleCase(c.category)}</span>
                  </div>
                  <h3 className="font-serif text-[18px] font-semibold leading-snug">
                    {c.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[13.5px] leading-[1.5] ink-2">
                    {c.summary}
                  </p>
                </div>
                <div className="flex shrink-0 flex-row gap-4 text-[12px] ink-3 sm:flex-col sm:items-end sm:gap-1.5">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen size={12} /> {c.lessonCount} lesson
                    {c.lessonCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} /> {c.enrolledCount} enrolled
                  </span>
                  <span>Updated {fmtDate(c.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
