"use client";

/**
 * User management — grant/revoke admin roles, suspend abusive accounts.
 *
 * Standard FilterPanel (search, role, status; URL-backed and persisted) plus
 * multi-select bulk actions: Select all / Unselect all, then Suspend,
 * Unsuspend, Grant role, or Revoke role for every selected user. Bulk actions
 * call the same audited per-user mutations as the row actions, so each change
 * gets its own audit-log entry. Your own account is skipped for suspend and
 * super-admin revoke.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Ban, Loader2, ShieldMinus, ShieldPlus, UserCheck } from "lucide-react";
import { api } from "@/lib/convex-api";
import { useUrlFilters } from "@/lib/use-url-filters";
import { runBulk, useBulkSelection } from "@/lib/use-bulk-selection";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/auf/EmptyState";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import { BulkActionBar, SelectCheckbox } from "@/components/auf/BulkActionBar";
import { cn } from "@/lib/utils";

type UserRow = {
  _id: string;
  email: string | null;
  name: string | null;
  roles: string[];
  suspendedAt: number | null;
  deletedAt: number | null;
  createdAt: number | null;
};

const GRANTABLE_ROLES = [
  "verifier",
  "moderator",
  "super-admin",
  "alumnus",
  "current-student",
];

const FILTER_ROLES = [
  "alumnus",
  "alumnus-pending",
  "current-student",
  "partner-employer-admin",
  "verified-employer-admin",
  "verifier",
  "moderator",
  "super-admin",
];

const FILTER_KEYS = ["q", "role", "status"] as const;

type BulkDialog =
  | { kind: "none" }
  | { kind: "suspend" }
  | { kind: "grant" }
  | { kind: "revoke" };

export default function AdminUsersPage() {
  const me = useQuery(api.users.getMe);
  const { values, set, reset, restored } = useUrlFilters("admin-users", FILTER_KEYS);
  const liveUsers = useQuery(api.admin.listUsers, {
    search: values.q || undefined,
    role: values.role || undefined,
    status: values.status || undefined,
    limit: 500,
  });
  // Keep showing the previous results while a new filter loads, so typing in
  // search doesn't swap the page for a spinner (and drop input focus).
  const [lastUsers, setLastUsers] = useState(liveUsers);
  if (liveUsers !== undefined && liveUsers !== lastUsers) setLastUsers(liveUsers);
  const users = liveUsers ?? lastUsers;

  const grantRole = useMutation(api.admin.grantRole);
  const revokeRole = useMutation(api.admin.revokeRole);
  const suspendUser = useMutation(api.admin.suspendUser);
  const unsuspendUser = useMutation(api.admin.unsuspendUser);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDialog, setBulkDialog] = useState<BulkDialog>({ kind: "none" });
  const [bulkReason, setBulkReason] = useState("");
  const [bulkRole, setBulkRole] = useState(GRANTABLE_ROLES[0]);

  const list = (users ?? []) as UserRow[];
  const selection = useBulkSelection(list.map((u) => u._id));

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Email or name…" },
    {
      type: "select",
      key: "role",
      label: "Role",
      allLabel: "Any role",
      options: [
        ...FILTER_ROLES.map((r) => ({ value: r, label: r })),
        { value: "none", label: "No roles" },
      ],
    },
    {
      type: "select",
      key: "status",
      label: "Status",
      allLabel: "Any status",
      options: [
        { value: "active", label: "Active" },
        { value: "suspended", label: "Suspended" },
        { value: "deleted", label: "Deleted" },
      ],
    },
  ];

  if (users === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (users === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <EmptyState
          message="Super-admin access required"
          cta={{ label: "Back to dashboard", href: "/admin/dashboard" }}
        />
      </div>
    );
  }

  const run = async (id: string, fn: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const selectedUsers = list.filter((u) => selection.selectedIds.includes(u._id));
  const isMe = (u: UserRow) => me?._id === u._id;

  /** Run one per-user mutation over an eligible subset and report the outcome. */
  const bulk = async (
    verb: string,
    eligible: UserRow[],
    action: (u: UserRow) => Promise<unknown>,
  ) => {
    const skipped = selectedUsers.length - eligible.length;
    if (eligible.length === 0) {
      toast.error(`None of the selected users can be ${verb.toLowerCase()}`);
      return;
    }
    setBulkBusy(true);
    try {
      const byId = new Map(eligible.map((u) => [u._id, u]));
      const { ok, failed } = await runBulk(
        eligible.map((u) => u._id),
        (id) => action(byId.get(id)!),
      );
      const parts = [`${verb} ${ok.length} user${ok.length === 1 ? "" : "s"}`];
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (failed.length > 0) parts.push(`${failed.length} failed`);
      (failed.length ? toast.warning : toast.success)(parts.join(" · "), {
        description: failed.length ? failed[0].message : undefined,
      });
      selection.deselect(ok);
      setBulkDialog({ kind: "none" });
    } finally {
      setBulkBusy(false);
    }
  };

  const onBulkSuspend = () => {
    const reason = bulkReason.trim();
    if (!reason) {
      toast.error("Reason required");
      return;
    }
    void bulk(
      "Suspended",
      selectedUsers.filter((u) => !isMe(u) && !u.deletedAt && !u.suspendedAt),
      (u) => suspendUser({ targetUserId: u._id as never, reason }),
    );
  };
  const onBulkUnsuspend = () =>
    void bulk(
      "Unsuspended",
      selectedUsers.filter((u) => u.suspendedAt && !u.deletedAt),
      (u) => unsuspendUser({ targetUserId: u._id as never }),
    );
  const onBulkRole = (mode: "grant" | "revoke") => {
    const role = bulkRole;
    const eligible = selectedUsers.filter((u) => {
      if (u.deletedAt) return false;
      const has = u.roles.includes(role);
      if (mode === "grant") return !has;
      return has && !(isMe(u) && role === "super-admin");
    });
    void bulk(
      mode === "grant" ? `Granted ${role} to` : `Revoked ${role} from`,
      eligible,
      (u) =>
        mode === "grant"
          ? grantRole({ targetUserId: u._id as never, role })
          : revokeRole({ targetUserId: u._id as never, role }),
    );
  };

  const suspendable = selectedUsers.filter((u) => !isMe(u) && !u.deletedAt && !u.suspendedAt).length;
  const unsuspendable = selectedUsers.filter((u) => u.suspendedAt && !u.deletedAt).length;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-6">
      <h1 className="text-2xl font-semibold tracking-tight">User management</h1>
      <p className="text-sm text-muted-foreground">
        Grant or revoke admin roles. Suspend abusive accounts. Select several
        users to act on them at once.
      </p>

      <FilterPanel
        layout="bar"
        className="mt-4"
        fields={fields}
        values={values}
        onChange={(k, v) => set(k as (typeof FILTER_KEYS)[number], v)}
        onReset={reset}
        restored={restored}
      />

      <BulkActionBar
        className="mt-4"
        noun="user"
        count={selection.count}
        total={selection.total}
        allSelected={selection.allSelected}
        someSelected={selection.someSelected}
        onSelectAll={selection.selectAll}
        onUnselectAll={selection.unselectAll}
      >
        <Button
          size="sm"
          variant="destructive"
          disabled={bulkBusy || suspendable === 0}
          onClick={() => {
            setBulkReason("");
            setBulkDialog({ kind: "suspend" });
          }}
        >
          <Ban className="h-3.5 w-3.5" /> Suspend{suspendable ? ` (${suspendable})` : ""}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={bulkBusy || unsuspendable === 0}
          onClick={onBulkUnsuspend}
        >
          <UserCheck className="h-3.5 w-3.5" /> Unsuspend{unsuspendable ? ` (${unsuspendable})` : ""}
        </Button>
        <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => setBulkDialog({ kind: "grant" })}>
          <ShieldPlus className="h-3.5 w-3.5" /> Grant role
        </Button>
        <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => setBulkDialog({ kind: "revoke" })}>
          <ShieldMinus className="h-3.5 w-3.5" /> Revoke role
        </Button>
      </BulkActionBar>

      <Card className="mt-3">
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No users match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2 text-left">
                      <SelectCheckbox
                        checked={selection.allSelected}
                        indeterminate={selection.someSelected}
                        onChange={selection.allSelected ? selection.unselectAll : selection.selectAll}
                        label={selection.allSelected ? "Unselect all users" : "Select all users"}
                      />
                    </th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Roles</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => {
                    const mine = isMe(u);
                    const suspended = u.suspendedAt != null;
                    const deleted = u.deletedAt != null;
                    const checked = selection.isSelected(u._id);
                    return (
                      <tr
                        key={u._id}
                        className={cn(
                          "border-b border-border align-top last:border-0",
                          checked && "bg-foreground/3",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <SelectCheckbox
                            checked={checked}
                            onChange={() => selection.toggle(u._id)}
                            label={`Select ${u.email ?? u.name ?? "user"}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">
                            {u.email ?? "—"}
                            {mine && (
                              <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground">
                                you
                              </span>
                            )}
                          </div>
                          {u.name && (
                            <div className="text-xs text-muted-foreground">
                              {u.name}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 && (
                              <span className="text-xs text-muted-foreground italic">
                                none
                              </span>
                            )}
                            {u.roles.map((r) => (
                              <span
                                key={r}
                                className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {deleted ? (
                            <span className="text-destructive">deleted</span>
                          ) : suspended ? (
                            <span className="text-[var(--color-warning)]">
                              suspended
                            </span>
                          ) : (
                            <span className="text-[var(--color-success)]">
                              active
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <select
                              disabled={busyId === u._id || deleted}
                              onChange={(e) => {
                                const role = e.target.value;
                                if (!role) return;
                                const has = u.roles.includes(role);
                                if (mine && role === "super-admin" && has) {
                                  toast.error(
                                    "Cannot revoke your own super-admin role",
                                  );
                                  e.target.value = "";
                                  return;
                                }
                                void run(
                                  u._id,
                                  () =>
                                    has
                                      ? revokeRole({
                                          targetUserId: u._id as unknown as never,
                                          role,
                                        })
                                      : grantRole({
                                          targetUserId: u._id as unknown as never,
                                          role,
                                        }),
                                  has ? `Revoked ${role}` : `Granted ${role}`,
                                );
                                e.target.value = "";
                              }}
                              className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                              defaultValue=""
                              aria-label={`Change roles for ${u.email ?? "user"}`}
                            >
                              <option value="">Role…</option>
                              {GRANTABLE_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {u.roles.includes(r)
                                    ? `Revoke ${r}`
                                    : `Grant ${r}`}
                                </option>
                              ))}
                            </select>
                            {suspended ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === u._id}
                                onClick={() =>
                                  run(
                                    u._id,
                                    () =>
                                      unsuspendUser({
                                        targetUserId: u._id as unknown as never,
                                      }),
                                    "Unsuspended",
                                  )
                                }
                              >
                                Unsuspend
                              </Button>
                            ) : (
                              <>
                                <Input
                                  placeholder="Suspend reason"
                                  value={busyId === u._id ? suspendReason : ""}
                                  onChange={(e) =>
                                    setSuspendReason(e.target.value)
                                  }
                                  onFocus={() => setBusyId(u._id)}
                                  className="h-7 w-40 text-xs"
                                  aria-label={`Suspend reason for ${u.email ?? "user"}`}
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={mine || deleted}
                                  onClick={() => {
                                    if (!suspendReason.trim()) {
                                      toast.error("Reason required");
                                      return;
                                    }
                                    void run(
                                      u._id,
                                      () =>
                                        suspendUser({
                                          targetUserId: u._id as unknown as never,
                                          reason: suspendReason.trim(),
                                        }),
                                      "Suspended",
                                    );
                                    setSuspendReason("");
                                  }}
                                >
                                  Suspend
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk suspend / role dialogs */}
      <Dialog
        open={bulkDialog.kind !== "none"}
        onOpenChange={(open) => !open && !bulkBusy && setBulkDialog({ kind: "none" })}
      >
        <DialogContent>
          {bulkDialog.kind === "suspend" && (
            <>
              <DialogHeader>
                <DialogTitle>Suspend {suspendable} user{suspendable === 1 ? "" : "s"}?</DialogTitle>
                <DialogDescription>
                  Suspended users can&apos;t sign in until unsuspended. Your own
                  account and users already suspended or deleted are skipped.
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label htmlFor="bulk-reason">Reason (recorded in the audit log)</Label>
                <Input
                  id="bulk-reason"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="e.g. Spam messages reported by alumni"
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkDialog({ kind: "none" })} disabled={bulkBusy}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={onBulkSuspend} disabled={bulkBusy || !bulkReason.trim()}>
                  {bulkBusy ? "Suspending…" : "Suspend"}
                </Button>
              </DialogFooter>
            </>
          )}
          {(bulkDialog.kind === "grant" || bulkDialog.kind === "revoke") && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {bulkDialog.kind === "grant" ? "Grant" : "Revoke"} a role for {selection.count} user
                  {selection.count === 1 ? "" : "s"}
                </DialogTitle>
                <DialogDescription>
                  {bulkDialog.kind === "grant"
                    ? "Users who already have the role are skipped."
                    : "Users without the role are skipped. You can't revoke your own super-admin role."}
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label htmlFor="bulk-role">Role</Label>
                <select
                  id="bulk-role"
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value)}
                  className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm"
                >
                  {GRANTABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkDialog({ kind: "none" })} disabled={bulkBusy}>
                  Cancel
                </Button>
                <Button onClick={() => onBulkRole(bulkDialog.kind === "grant" ? "grant" : "revoke")} disabled={bulkBusy}>
                  {bulkBusy ? "Working…" : bulkDialog.kind === "grant" ? "Grant role" : "Revoke role"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
