"use client";

/**
 * Admin account-lifecycle control for one employer or alumnus.
 *
 * Active account → Deactivate (cancel) or Reject, each with a required reason.
 * Deactivated / rejected / suspended account → shows the state + reason and a
 * Reactivate button. Persisted in Convex (convex/accountStatus.ts) and audited;
 * the same fields block sign-in and hide the account from the network.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Ban, Loader2, RotateCcw, ShieldX } from "lucide-react";
import { api } from "@/lib/convex-api";
import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TONE,
  type AccountStatus,
} from "@/lib/account-status";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Decision = "deactivated" | "rejected";

function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AccountStatusCard({
  id,
  name,
  kind,
  status,
}: {
  /** Profile id for an alumnus, employerOrgs id for an employer. */
  id: string;
  name: string;
  kind: "alumnus" | "employer";
  status: AccountStatus;
}) {
  const setAlumnus = useMutation(api.accountStatus.setAlumnusStatus);
  const reactivateAlumnus = useMutation(api.accountStatus.reactivateAlumnus);
  const setEmployer = useMutation(api.accountStatus.setEmployerStatus);
  const reactivateEmployer = useMutation(api.accountStatus.reactivateEmployer);

  const [dialog, setDialog] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const noun = kind === "employer" ? "employer" : "alumnus";

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (!dialog) return;
    const why = reason.trim();
    if (!why) {
      toast.error("A reason is required");
      return;
    }
    const ok = await run(
      () =>
        kind === "employer"
          ? setEmployer({ employerOrgId: id as never, kind: dialog, reason: why })
          : setAlumnus({ profileId: id as never, kind: dialog, reason: why }),
      `${name} ${dialog === "deactivated" ? "deactivated" : "rejected"}`,
    );
    if (ok) {
      setDialog(null);
      setReason("");
    }
  };

  const onReactivate = () =>
    run(
      () =>
        kind === "employer"
          ? reactivateEmployer({ employerOrgId: id as never })
          : reactivateAlumnus({ profileId: id as never }),
      `${name} reactivated`,
    );

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Account status</h2>
          {status ? (
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
                ACCOUNT_STATUS_TONE[status.kind],
              )}
            >
              {ACCOUNT_STATUS_LABEL[status.kind]}
            </span>
          ) : (
            <span className="inline-flex h-5 items-center rounded-full bg-emerald-500/10 px-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Active
            </span>
          )}
        </div>

        {status ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <div className="text-xs text-muted-foreground">
                {ACCOUNT_STATUS_LABEL[status.kind]} on {fmtDay(status.at)}
              </div>
              {status.reason && <div className="mt-0.5">{status.reason}</div>}
            </div>
            <p className="text-xs text-muted-foreground">
              {kind === "employer"
                ? "This employer is hidden from company pages and the job board."
                : "This alumnus can't sign in and is hidden from the directory."}{" "}
              Reactivate to restore access.
            </p>
            <Button size="sm" onClick={() => void onReactivate()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reactivate account
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Deactivating hides the {noun} from the network (reversible).
              Rejecting denies the account. Both are recorded with a reason in
              the audit log.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setDialog("deactivated");
                  setReason("");
                }}
              >
                <Ban className="h-4 w-4" />
                Deactivate
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDialog("rejected");
                  setReason("");
                }}
              >
                <ShieldX className="h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={dialog !== null} onOpenChange={(o) => !o && !busy && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "rejected" ? "Reject" : "Deactivate"} {name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "rejected"
                ? `This denies the ${noun} account. It can be reactivated later.`
                : `This hides the ${noun} from the network. It can be reactivated anytime.`}{" "}
              The reason is recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            maxLength={500}
            aria-label="Reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onConfirm();
              }}
              disabled={!reason.trim() || busy}
            >
              {busy ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
