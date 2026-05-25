"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";

type AuditRow = {
  _id: string;
  actorId?: string;
  actorType: string;
  actorEmail: string | null;
  actionType: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: unknown;
  timestamp: number;
};

const ACTION_TYPES = [
  "approve-verification",
  "reject-verification",
  "request-verification-info",
  "escalate-verification",
  "grant-role",
  "revoke-role",
  "suspend-user",
  "unsuspend-user",
  "request-account-deletion",
  "hard-delete-user",
  "verification-artifact-purged",
];

export default function AdminAuditPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const actionType = sp.get("action") || undefined;
  const targetType = sp.get("target") || undefined;

  const rows = useQuery(api.admin.auditLog, {
    actionType,
    targetType,
    limit: 200,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace("/admin/audit?" + next.toString(), { scroll: false });
  };

  if (rows === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (rows === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <EmptyState
          message="Admin access required"
          cta={{ label: "Sign in", href: "/login" }}
        />
      </div>
    );
  }

  const list = rows as AuditRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="text-sm text-muted-foreground">
        Immutable append-only log of every admin action.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label
            htmlFor="action"
            className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground"
          >
            Action
          </Label>
          <select
            id="action"
            value={actionType ?? ""}
            onChange={(e) => setParam("action", e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">All actions</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label
            htmlFor="target"
            className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground"
          >
            Target type
          </Label>
          <Input
            id="target"
            value={targetType ?? ""}
            onChange={(e) => setParam("target", e.target.value)}
            placeholder="user / verificationSubmission / …"
            className="w-72"
          />
        </div>
        {(actionType || targetType) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace("/admin/audit", { scroll: false })}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No audit entries match the current filters.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr
                    key={row._id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === row._id ? null : row._id)
                    }
                  >
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {row.actorType === "system" ? (
                        <span className="text-muted-foreground italic">
                          system
                        </span>
                      ) : (
                        row.actorEmail ?? row.actorId ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-xs">
                      {row.actionType}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-xs">
                      {row.targetType}/{row.targetId.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {row.reason ?? "—"}
                      {expandedId === row._id && row.metadata != null && (
                        <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[11px]">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
