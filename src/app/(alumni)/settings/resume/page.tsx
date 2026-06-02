"use client";

/**
 * Resume settings — manage the alumna's default profile resume.
 *
 * Two paths:
 *   1. Upload a PDF / DOC / DOCX from disk → stored in Convex Storage,
 *      pointer + filename saved on the profile, reusable on every job
 *      application.
 *   2. Auto-generate a resume from the alumna's profile fields → opens
 *      `/resume/preview` in a new tab; the user prints to PDF via the
 *      browser and (optionally) re-uploads it back here.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "@/lib/convex-api";

type ResumeMeta = {
  filename: string;
  uploadedAt: number | null;
  url: string | null;
} | null;

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ACCEPTED = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function ResumeSettingsPage() {
  const resume = useQuery(api.profiles.getMyProfileResume) as
    | ResumeMeta
    | undefined;
  const getUploadUrl = useMutation(api.profiles.generateProfileResumeUploadUrl);
  const setResume = useMutation(api.profiles.setMyProfileResume);
  const removeResume = useMutation(api.profiles.removeMyProfileResume);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = async (file: File) => {
    if (!/\.(pdf|doc|docx)$/i.test(file.name)) {
      toast.error("Resume must be a PDF, DOC, or DOCX");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Resume must be ≤ 8 MB");
      return;
    }
    setUploading(true);
    try {
      const url = await getUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      await setResume({
        storageId: storageId as unknown as never,
        filename: file.name,
      });
      toast.success("Resume saved");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    if (!resume) return;
    if (!confirm("Remove your saved resume?")) return;
    setRemoving(true);
    try {
      await removeResume({});
      toast.success("Resume removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="section-eyebrow brand-fg">Resume</div>
      <h1 className="font-serif text-2xl sm:text-3xl font-semibold mt-1">
        Your default resume
      </h1>
      <p className="text-[14px] ink-2 mt-2 max-w-prose">
        Keep one resume on file and re-use it on every job application — or
        let us auto-generate one from your profile, then upload the saved
        PDF back here.
      </p>

      {/* Current resume */}
      <div className="auf-card p-5 mt-6">
        {resume === undefined ? (
          <Loader2 className="h-5 w-5 animate-spin ink-3" />
        ) : resume === null ? (
          <p className="text-[14px] ink-3">
            No resume on file yet. Upload one or generate from your profile
            below.
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md brand-50 brand-fg flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[14px] truncate">
                {resume.filename}
              </div>
              <div className="text-[12px] ink-3 mt-0.5">
                Uploaded {formatDate(resume.uploadedAt)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {resume.url && (
                  <a
                    href={resume.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="auf-btn auf-btn-outline auf-btn-sm"
                  >
                    View / download
                  </a>
                )}
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={removing}
                  className="auf-btn auf-btn-ghost auf-btn-sm"
                >
                  {removing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="auf-card p-5 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Upload size={16} className="brand-fg" />
          <h2 className="font-medium text-[15px]">Upload from disk</h2>
        </div>
        <p className="text-[12.5px] ink-3 mb-3">
          PDF, DOC, or DOCX up to 8 MB. Replacing keeps only the latest
          file.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
          className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-(--brand-50) file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-(--brand-ink) hover:file:bg-(--brand-100)"
        />
        {uploading && (
          <div className="mt-2 inline-flex items-center gap-2 text-[12px] ink-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
          </div>
        )}
      </div>

      {/* Generate */}
      <div className="auf-card p-5 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="gold-fg" />
          <h2 className="font-medium text-[15px]">Generate from my profile</h2>
        </div>
        <p className="text-[12.5px] ink-3 mb-3">
          Opens a clean, print-styled resume built from your profile fields
          (name, program, experience, education, skills). Save as PDF via
          your browser&apos;s print dialog, then come back here to upload it
          if you want to attach it to future applications.
        </p>
        <Link
          href="/resume/preview"
          target="_blank"
          rel="noopener noreferrer"
          className="auf-btn auf-btn-primary"
        >
          <Sparkles size={14} /> Open preview
        </Link>
      </div>
    </div>
  );
}
