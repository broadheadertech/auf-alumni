"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";

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

export default function NewCoursePage() {
  const router = useRouter();
  const createCourse = useMutation(api.academy.createCourse);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("career");
  const [level, setLevel] = useState<string>("beginner");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!summary.trim()) {
      toast.error("Summary is required");
      return;
    }
    if (summary.length > SUMMARY_MAX) {
      toast.error(`Summary must be ≤ ${SUMMARY_MAX} characters`);
      return;
    }
    if (description.length > DESCRIPTION_MAX) {
      toast.error(`Description must be ≤ ${DESCRIPTION_MAX} characters`);
      return;
    }
    setBusy(true);
    try {
      const result = await createCourse({
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        category,
        level,
      });
      toast.success("Draft created — add your first lesson");
      router.push(`/academy/teach/${result.slug}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create course");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[760px] px-4 sm:px-7 py-6 sm:py-8">
      <Link
        href="/academy/teach"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] ink-3 hover:ink-2"
      >
        <ArrowLeft size={14} /> Back to your courses
      </Link>

      <div className="mb-6">
        <div className="section-eyebrow mb-1">New course</div>
        <h1 className="font-serif text-[28px] font-semibold leading-tight">
          Create a course
        </h1>
        <p className="mt-1.5 text-[13.5px] ink-2">
          Start with the framing — you'll add lessons after the draft is saved.
        </p>
      </div>

      <form onSubmit={onSubmit} className="auf-card space-y-5 p-5 sm:p-6">
        <div>
          <label className="mb-1 block text-[13px] font-medium ink-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Negotiating your first salary"
            className="auf-input"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium ink-2">
            One-line summary <span className="text-red-500">*</span>
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={SUMMARY_MAX}
            rows={2}
            placeholder="What will learners take away in one sentence?"
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
            placeholder="Markdown supported. Use **bold** and *italic*. Two newlines for a new paragraph."
            className="auf-input resize-y"
          />
          <div className="mt-1 text-right text-[11px] ink-3">
            {description.length}/{DESCRIPTION_MAX}
          </div>
        </div>

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
            Level <span className="text-red-500">*</span>
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

        <div className="auf-hairline flex items-center justify-end gap-2 border-t pt-4">
          <Link href="/academy/teach" className="auf-btn auf-btn-outline">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="auf-btn auf-btn-primary"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Creating…
              </>
            ) : (
              "Create draft"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
