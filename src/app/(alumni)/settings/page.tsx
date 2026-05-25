"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { Download, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const me = useQuery(api.users.getMe);
  const myExport = useQuery(api.profiles.exportMyData);
  const requestDeletion = useMutation(api.profiles.requestAccountDeletion);
  const recordExportRequest = useMutation(api.profiles.recordExportRequest);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const onExport = async () => {
    if (!myExport) return;
    setDownloading(true);
    try {
      // Story 7.2 — log the DSR for SLA tracking
      try {
        await recordExportRequest({});
      } catch {
        // Non-fatal; logging is bookkeeping, not blocking the download
      }
      const json = JSON.stringify(myExport, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auf-alumni-export-${myExport.user?._id ?? "me"}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Your data exported");
    } finally {
      setDownloading(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      const result = await requestDeletion({ confirmationText: confirmText });
      if (result.alreadyDeleted) {
        toast.success("Your account is already scheduled for deletion");
      } else {
        toast.success(
          "Account deletion scheduled. We'll hard-delete in 30 days.",
        );
      }
      await signOut();
      router.push("/");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete account",
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmEnabled =
    me?.email != null &&
    confirmText.trim().toLowerCase() === (me.email ?? "").toLowerCase();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Account and data rights.
      </p>

      {me?.deletedAt && (
        <Card className="mt-6 border-destructive/40 bg-destructive/5">
          <CardContent className="p-6">
            <h2 className="font-semibold text-destructive">
              Account scheduled for deletion
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account was soft-deleted and will be hard-deleted on{" "}
              {me.deletedAtHardDeleteScheduledFor
                ? new Date(me.deletedAtHardDeleteScheduledFor).toLocaleDateString()
                : "the 30-day mark"}
              . To restore, contact ops@aufalumni.example.com.
            </p>
          </CardContent>
        </Card>
      )}

      {/* DPA self-export (Story 3.6) */}
      <Card className="mt-6">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-start gap-3">
            <Download
              className="h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex-1">
              <h2 className="font-semibold">Export my data</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Download a JSON file with your account data, profile,
                verification submissions, and any audit entries about your
                account. This is your DPA right to portability.
              </p>
            </div>
          </div>
          <div>
            <Button
              type="button"
              onClick={onExport}
              disabled={!myExport || downloading}
            >
              {downloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download my data (JSON)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account deletion (Story 3.7) */}
      <Card className="mt-6 border-destructive/40">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div className="flex-1">
              <h2 className="font-semibold">Delete my account</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Soft-deletes immediately (profile hidden, connections cleared,
                verification artifacts purged). Hard-delete runs 30 days later
                and is irreversible.
              </p>
            </div>
          </div>
          {!me?.deletedAt && (
            <AlertDialog>
              <AlertDialogTrigger
                className={buttonVariants({ variant: "destructive" })}
              >
                Delete my account…
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Permanently delete your AUF Alumni account?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Your profile, connections, and data export are removed
                    immediately. After 30 days, the underlying records are
                    hard-deleted and cannot be restored.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-2">
                  <Label htmlFor="confirm">
                    Type your email ({me?.email ?? "—"}) to confirm
                  </Label>
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirmEnabled) onDelete();
                    }}
                    disabled={!confirmEnabled || deleting}
                  >
                    {deleting ? "Deleting…" : "Permanently delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
