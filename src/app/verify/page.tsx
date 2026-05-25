"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { api } from "@/lib/convex-api";
import { PROGRAMS } from "@/lib/schemas/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VerifiedBadge } from "@/components/auf/VerifiedBadge";
import { SiteNav, SiteFooter } from "@/components/auf/SiteNav";

const CURRENT_YEAR = new Date().getFullYear();
const BATCH_OPTIONS: number[] = [];
for (let y = CURRENT_YEAR; y >= 1960; y--) BATCH_OPTIONS.push(y);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/jpeg,image/png,application/pdf";

export default function VerifyPage() {
  const submission = useQuery(api.verification.getMyVerification);
  const submitManual = useMutation(api.verification.submitManual);
  const updateSubmission = useMutation(api.verification.updateSubmission);
  const generateUploadUrl = useMutation(api.verification.generateUploadUrl);

  const [claimedName, setClaimedName] = useState("");
  const [claimedBatch, setClaimedBatch] = useState<number>(CURRENT_YEAR);
  const [claimedProgram, setClaimedProgram] = useState<string>(PROGRAMS[0]);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function uploadFile(file: File): Promise<string> {
    const url = await generateUploadUrl({});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error("Upload failed");
    const json = (await res.json()) as { storageId: string };
    return json.storageId;
  }

  function validateFile(file: File | null, label: string): string | null {
    if (!file) return `${label} is required`;
    if (file.size > MAX_BYTES) return `${label} must be 10 MB or smaller`;
    if (!ACCEPT.split(",").includes(file.type))
      return `${label} must be JPG, PNG, or PDF`;
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const idError = validateFile(idFile, "Government ID");
    const diplomaError = validateFile(diplomaFile, "Diploma photo");
    if (idError || diplomaError) {
      toast.error(idError ?? diplomaError ?? "Check your uploads");
      return;
    }
    if (claimedName.trim().length === 0) {
      toast.error("Full name as it appears on your diploma is required");
      return;
    }
    setSubmitting(true);
    try {
      const [idStorageId, diplomaStorageId] = await Promise.all([
        uploadFile(idFile!),
        uploadFile(diplomaFile!),
      ]);
      const args = {
        claimedName: claimedName.trim(),
        claimedBatch,
        claimedProgram,
        idStorageId: idStorageId as unknown as never,
        diplomaStorageId: diplomaStorageId as unknown as never,
      };
      if (submission && submission.status !== "approved" && submission.status !== "approved-fast-path") {
        await updateSubmission(args);
        toast.success("Submission updated — review pending");
      } else {
        await submitManual(args);
        toast.success("Submitted for review");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const isApproved =
    submission?.status === "approved" ||
    submission?.status === "approved-fast-path";

  return (
    <div data-density="comfortable" className="flex min-h-screen flex-col">
      <SiteNav role="marketing" />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-12">
          {/* Status panel */}
          {submission && (
            <StatusPanel submission={submission} />
          )}

          {isApproved ? (
            <div className="mt-6 flex justify-center">
              <Link
                href="/directory"
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Continue to directory →
              </Link>
            </div>
          ) : (
            <Card className="mt-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold">
                  {submission ? "Update your submission" : "Verify your AUF affiliation"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload a government ID + your AUF diploma photo. Median
                  turnaround is under 48 hours.
                </p>
                <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
                  <div>
                    <Label htmlFor="claimedName">
                      Full name (as it appears on your diploma)
                    </Label>
                    <Input
                      id="claimedName"
                      value={claimedName}
                      onChange={(e) => setClaimedName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="claimedBatch">Batch year</Label>
                      <Select
                        value={String(claimedBatch)}
                        onValueChange={(v) => setClaimedBatch(Number(v ?? CURRENT_YEAR))}
                      >
                        <SelectTrigger id="claimedBatch">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BATCH_OPTIONS.map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="claimedProgram">Program</Label>
                      <Select
                        value={claimedProgram}
                        onValueChange={(v) => setClaimedProgram(v ?? PROGRAMS[0])}
                      >
                        <SelectTrigger id="claimedProgram">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROGRAMS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="idFile">Government ID</Label>
                    <Input
                      id="idFile"
                      type="file"
                      accept={ACCEPT}
                      onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG, or PDF · max 10 MB · stored encrypted, deleted
                      30 days after decision
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="diplomaFile">Diploma photo</Label>
                    <Input
                      id="diplomaFile"
                      type="file"
                      accept={ACCEPT}
                      onChange={(e) =>
                        setDiplomaFile(e.target.files?.[0] ?? null)
                      }
                      required
                    />
                  </div>
                  <Button type="submit" size="lg" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {submission ? "Update submission" : "Submit for review"}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatusPanel({
  submission,
}: {
  submission: {
    status: string;
    statusReason?: string | undefined;
    decidedAt?: number | undefined;
    flags: string[];
  };
}) {
  const isApproved =
    submission.status === "approved" || submission.status === "approved-fast-path";

  if (isApproved) {
    return (
      <Card className="border-[var(--color-success)]/30 bg-[oklch(0.65_0.17_145_/_0.05)]">
        <CardContent className="flex items-start gap-4 p-6">
          <CheckCircle
            className="h-6 w-6 shrink-0 text-[var(--color-success)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">You&apos;re verified</h2>
              <VerifiedBadge size="sm" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              You can now use the full AUF Alumni Network.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (submission.status === "pending-review") {
    return (
      <Card>
        <CardContent className="flex items-start gap-4 p-6">
          <Clock
            className="h-6 w-6 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Submitted — in review</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;re checking your name against the AUF registry. Median
              turnaround is under 48 hours. We&apos;ll email you the result.
            </p>
            {submission.flags.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Flags noted by our reviewer:{" "}
                {submission.flags
                  .map((f) => f.replaceAll("-", " "))
                  .join(", ")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (submission.status === "info-requested") {
    return (
      <Card className="border-[var(--color-warning)]/40 bg-[oklch(0.70_0.15_60_/_0.05)]">
        <CardContent className="flex items-start gap-4 p-6">
          <AlertTriangle
            className="h-6 w-6 shrink-0 text-[var(--color-warning)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">More info requested</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {submission.statusReason ??
                "We need a clearer copy of one of your documents. Update your submission below."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (submission.status === "rejected") {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex items-start gap-4 p-6">
          <AlertTriangle
            className="h-6 w-6 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Verification rejected</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {submission.statusReason ??
                "Your submission did not match our records. You can update it below and resubmit."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
