"use client";

/**
 * Admin override of an alumnus's employment status.
 *
 * Employment status is otherwise self-serve — only the alumnus could set it,
 * which left Alumni Relations unable to record what it learns off-platform
 * (a tracer-study phone call, a graduate who plainly moved on and never
 * updated their profile). Since the status feeds tracer-study reporting, a
 * roster nobody can correct is a reporting problem, not just a clerical one.
 *
 * The reason box is required rather than decorative: the mutation refuses an
 * empty one, and the value lands in the audit log so the record says why an
 * admin changed someone else's profile, not merely that they did.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Briefcase, Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLookupOptions } from "@/lib/use-lookup-options";

/** Select needs a non-empty value, so "no status" gets a sentinel. */
const CLEARED = "__cleared";

export function EmploymentStatusCard({
  profileId,
  name,
  current,
}: {
  profileId: string;
  name: string;
  current: string | null;
}) {
  const { names, ready } = useLookupOptions("status");
  const setStatus = useMutation(api.adminAlumni.setEmploymentStatus);

  const [value, setValue] = useState<string>(current ?? CLEARED);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const next = value === CLEARED ? "" : value;
  const unchanged = (current ?? "") === next;
  const canSave = !unchanged && reason.trim().length > 0 && !saving;

  const onSave = async () => {
    setSaving(true);
    try {
      await setStatus({
        profileId: profileId as never,
        status: next,
        reason: reason.trim(),
      });
      toast.success(
        next
          ? `${name}'s employment status set to "${next}"`
          : `Cleared ${name}'s employment status`,
      );
      setReason("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not change the status",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-tour="employment-override">
      <CardContent className="p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Briefcase className="h-4 w-4" />
          Employment status
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Currently{" "}
          <span className="text-foreground">{current ?? "not set"}</span>, set
          by {name}. Overriding this changes their profile and is recorded in
          the audit log.
        </p>

        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="emp-status" className="text-xs">
              New status
            </Label>
            <Select value={value} onValueChange={(v) => setValue(v ?? CLEARED)}>
              <SelectTrigger id="emp-status" className="mt-1">
                <SelectValue placeholder={ready ? "Choose a status" : "Loading…"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLEARED}>Not set</SelectItem>
                {names.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="emp-reason" className="text-xs">
              Reason
            </Label>
            <Input
              id="emp-reason"
              className="mt-1"
              placeholder="e.g. Confirmed employed during the 2026 tracer study call"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <Button
            type="button"
            size="sm"
            disabled={!canSave}
            onClick={onSave}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Override status"
            )}
          </Button>
          {unchanged ? (
            <p className="text-xs text-muted-foreground">
              Pick a different status to enable the override.
            </p>
          ) : reason.trim().length === 0 ? (
            <p className="text-xs text-muted-foreground">
              A reason is required.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
