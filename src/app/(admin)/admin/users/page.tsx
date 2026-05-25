"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";

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

export default function AdminUsersPage() {
  const me = useQuery(api.users.getMe);
  const [search, setSearch] = useState("");
  const users = useQuery(api.admin.listUsers, { search, limit: 100 });

  const grantRole = useMutation(api.admin.grantRole);
  const revokeRole = useMutation(api.admin.revokeRole);
  const suspendUser = useMutation(api.admin.suspendUser);
  const unsuspendUser = useMutation(api.admin.unsuspendUser);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  if (users === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (users === null) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <EmptyState
          message="Super-admin access required"
          cta={{ label: "Back to dashboard", href: "/admin/dashboard" }}
        />
      </div>
    );
  }

  const list = users as UserRow[];

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

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">User management</h1>
      <p className="text-sm text-muted-foreground">
        Grant or revoke admin roles. Suspend abusive accounts.
      </p>

      <Input
        placeholder="Search email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 max-w-md"
      />

      <Card className="mt-4">
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No users match.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Roles</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => {
                  const isMe = me?._id === u._id;
                  const suspended = u.suspendedAt != null;
                  const deleted = u.deletedAt != null;
                  return (
                    <tr
                      key={u._id}
                      className="border-b border-border align-top last:border-0"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{u.email ?? "—"}</div>
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
                              if (isMe && role === "super-admin" && has) {
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
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isMe || deleted}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
