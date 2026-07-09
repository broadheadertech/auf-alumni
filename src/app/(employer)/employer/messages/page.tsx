"use client";

/**
 * Employer messages — the employer can message an alumna once she has applied
 * to one of its postings. Left pane lists applicants (potential conversations);
 * the right pane is the thread + composer. Persisted locally for the prototype.
 */

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Send } from "lucide-react";
import { EMPLOYER_APPLICANTS, STAGE_LABEL, fmtDate } from "@/lib/mock-admin";
import {
  sendEmployerMessage,
  useEmployerThreads,
} from "@/lib/employer-messages";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StageBadge } from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";

export default function EmployerMessagesPage() {
  return (
    <Suspense fallback={<div className="p-10" />}>
      <MessagesInner />
    </Suspense>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessagesInner() {
  const threads = useEmployerThreads();
  const sp = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(
    sp.get("applicant"),
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  const contacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EMPLOYER_APPLICANTS.filter((a) =>
      q ? (a.name + " " + a.jobTitle).toLowerCase().includes(q) : true,
    ).sort((a, b) => {
      // conversations with messages first, most recent by last message
      const la = threads[a.id]?.at(-1)?.at ?? "";
      const lb = threads[b.id]?.at(-1)?.at ?? "";
      if (la && lb) return lb.localeCompare(la);
      if (la) return -1;
      if (lb) return 1;
      return b.appliedAt.localeCompare(a.appliedAt);
    });
  }, [search, threads]);

  const selected =
    EMPLOYER_APPLICANTS.find((a) => a.id === selectedId) ?? contacts[0] ?? null;
  const thread = selected ? (threads[selected.id] ?? []) : [];

  const send = () => {
    if (!selected || !draft.trim()) return;
    sendEmployerMessage(selected.id, draft);
    setDraft("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reach out to alumni who applied to your postings.
      </p>

      <div className="mt-5 grid h-[70vh] gap-0 overflow-hidden rounded-xl border border-border lg:grid-cols-[300px_1fr]">
        {/* Contacts */}
        <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search applicants…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {contacts.map((a) => {
              const last = threads[a.id]?.at(-1);
              const isSel = selected?.id === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0",
                    isSel ? "bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {a.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {a.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {last ? last.text : a.jobTitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thread */}
        {selected ? (
          <div className="flex min-h-0 flex-col">
            {/* header */}
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {selected.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{selected.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  Applied to {selected.jobTitle} · {STAGE_LABEL[selected.stage]}
                </div>
              </div>
              <StageBadge stage={selected.stage} />
            </div>

            {/* messages */}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/20 p-4">
              <p className="mx-auto max-w-sm rounded-md bg-muted px-3 py-1.5 text-center text-[11px] text-muted-foreground">
                Applied {fmtDate(selected.appliedAt)}. Messaging is available
                because {selected.name.split(" ")[0]} applied to your posting.
              </p>
              {thread.length === 0 ? (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  No messages yet — say hello.
                </p>
              ) : (
                thread.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      m.from === "employer" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                        m.from === "employer"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card ring-1 ring-border",
                      )}
                    >
                      <div className="whitespace-pre-wrap">{m.text}</div>
                      <div
                        className={cn(
                          "mt-0.5 text-[10px]",
                          m.from === "employer"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {fmtTime(m.at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* composer */}
            <div className="flex items-end gap-2 border-t border-border p-3">
              <Textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message ${selected.name.split(" ")[0]}…`}
                className="min-h-9 resize-none"
              />
              <Button onClick={send} disabled={!draft.trim()}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
            No applicants to message yet.
          </div>
        )}
      </div>

      <p className="mt-3 text-xs italic text-muted-foreground">
        Demo messaging — persisted in this browser. Alumni replies would arrive
        in their own Messages once wired to the backend.
      </p>
    </div>
  );
}
