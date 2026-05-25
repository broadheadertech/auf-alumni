"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/auf/EmptyState";
import { cn } from "@/lib/utils";

type Tab = "incoming" | "outgoing" | "connected";

export default function ConnectionsPage() {
  const inbox = useQuery(api.connections.inbox);
  const accept = useMutation(api.connections.accept);
  const decline = useMutation(api.connections.decline);
  const withdraw = useMutation(api.connections.withdraw);
  const [tab, setTab] = useState<Tab>("incoming");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (inbox === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (inbox === null) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <EmptyState
          message="Sign in to manage your connections"
          cta={{ label: "Sign in", href: "/login" }}
        />
      </div>
    );
  }

  const incoming = inbox.incoming as Array<{
    connectionId: string;
    otherUserId: string;
    otherProfileSlug: string | null;
    otherName: string | null;
    note?: string;
    createdAt: number;
  }>;
  const outgoing = inbox.outgoing as typeof incoming;
  const connected = inbox.connected as typeof incoming;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "incoming", label: "Incoming", count: incoming.length },
    { id: "outgoing", label: "Outgoing", count: outgoing.length },
    { id: "connected", label: "Connected", count: connected.length },
  ];

  const list = tab === "incoming" ? incoming : tab === "outgoing" ? outgoing : connected;

  const runAction = async (
    id: string,
    fn: () => Promise<unknown>,
    success: string,
  ) => {
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pending requests and active connections.
      </p>

      <div
        role="tablist"
        aria-label="Connection tabs"
        className="mt-6 inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-1"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="mt-6">
        {list.length === 0 ? (
          <EmptyState
            message={
              tab === "incoming"
                ? "No incoming requests"
                : tab === "outgoing"
                  ? "No outgoing requests"
                  : "You haven't connected with anyone yet"
            }
            description={
              tab === "connected"
                ? "Start in the directory — send a connection request to someone you'd like to know."
                : undefined
            }
            cta={
              tab === "connected"
                ? { label: "Browse the directory", href: "/directory" }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {list.map((row) => (
              <Card key={row.connectionId}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {row.otherProfileSlug ? (
                        <Link
                          href={`/profile/${row.otherProfileSlug}`}
                          className="hover:underline"
                        >
                          {row.otherName ?? "Unknown alumna"}
                        </Link>
                      ) : (
                        row.otherName ?? "Unknown alumna"
                      )}
                    </div>
                    {row.note && (
                      <p className="mt-1 text-sm italic text-muted-foreground">
                        “{row.note}”
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {tab === "incoming" && (
                      <>
                        <Button
                          size="sm"
                          disabled={busyId === row.connectionId}
                          onClick={() =>
                            runAction(
                              row.connectionId,
                              () =>
                                accept({
                                  connectionId: row.connectionId as unknown as never,
                                }),
                              "Connected",
                            )
                          }
                        >
                          {busyId === row.connectionId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-4 w-4" />
                          )}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === row.connectionId}
                          onClick={() =>
                            runAction(
                              row.connectionId,
                              () =>
                                decline({
                                  connectionId: row.connectionId as unknown as never,
                                }),
                              "Declined",
                            )
                          }
                        >
                          Decline
                        </Button>
                      </>
                    )}
                    {tab === "outgoing" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.connectionId}
                        onClick={() =>
                          runAction(
                            row.connectionId,
                            () =>
                              withdraw({
                                connectionId: row.connectionId as unknown as never,
                              }),
                            "Request withdrawn",
                          )
                        }
                      >
                        {busyId === row.connectionId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="mr-1 h-4 w-4" />
                        )}
                        Withdraw
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
