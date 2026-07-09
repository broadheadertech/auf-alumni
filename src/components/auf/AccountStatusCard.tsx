"use client";

/**
 * Admin account-lifecycle control for one employer or alumnus.
 *
 * Active account → Deactivate (cancel) or Reject, each with a required reason.
 * Deactivated / rejected account → shows the state + reason and a Reactivate
 * button. State is held in the shared account-status store so rosters and
 * detail pages stay in sync.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Ban, RotateCcw, ShieldX } from "lucide-react";
import {
  ACCOUNT_STATUS_LABEL,
  clearAccountStatus,
  setAccountStatus,
  useAccountStatus,
  type AccountStatusKind,
} from "@/lib/account-status";
import { fmtDate } from "@/lib/mock-admin";
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

export function AccountStatusCard({
  id,
  name,
  kind,
}: {
  id: string;
  name: string;
  kind: "alumnus" | "employer";
}) {
  const status = useAccountStatus(id);
  const [dialog, setDialog] = useState<AccountStatusKind | null>(null);
  const [reason, setReason] = useState("");

  const noun = kind === "employer" ? "employer" : "alumnus";

  const onConfirm = () => {
    if (!dialog) return;
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }
    setAccountStatus(id, dialog, reason.trim());
    toast.success(
      `${name} ${dialog === "deactivated" ? "deactivated" : "rejected"}`,
    );
    setDialog(null);
    setReason("");
  };

  const onReactivate = () => {
    clearAccountStatus(id);
    toast.success(`${name} reactivated`);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Account status</h2>
          {status ? (
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
                status.kind === "rejected"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
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
                {ACCOUNT_STATUS_LABEL[status.kind]} on {fmtDate(status.at)}
              </div>
              <div className="mt-0.5">{status.reason}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              This account is hidden from the network. Reactivate to restore
              access.
            </p>
            <Button size="sm" onClick={onReactivate}>
              <RotateCcw className="h-4 w-4" />
              Reactivate account
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Deactivating hides the {noun} from the network (reversible).
              Rejecting denies the account. Both are recorded with a reason.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
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

      <AlertDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
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
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              disabled={!reason.trim()}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
