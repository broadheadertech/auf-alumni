"use client";

/**
 * Employer messages — message alumni who applied to your postings.
 *
 * Contacts are the live applicants to this employer's postings
 * (api.jobs.myApplicants, one row per person). Conversations are real Convex
 * messages (api.messaging): the server allows an employer admin to message
 * anyone who applied to their postings, and the applicant can reply in that
 * thread from their own Messages page.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2, Search, Send } from "lucide-react";
import { api } from "@/lib/convex-api";
import { STAGE_LABEL, type ApplicationStage } from "@/lib/mock-admin";
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

type ApplicantRow = {
  _id: string;
  applicantId: string;
  jobTitle: string;
  stage: string;
  createdAt: number;
  snapshot?: { displayName?: string; initials?: string } | null;
};

type Contact = {
  userId: string;
  applicationIds: string[];
  name: string;
  initials: string;
  jobTitles: string[];
  appliedAt: number; // most recent application
  stage: ApplicationStage; // stage on the most recent application
};

type ThreadSummary = {
  otherUserId: string;
  lastMessageAt: number;
  lastMessagePreview: string;
  unread: number;
};

const STAGES: ApplicationStage[] = ["new", "screening", "interview", "offered", "hired", "not-selected"];

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MessagesInner() {
  const applicants = useQuery(api.jobs.myApplicants) as ApplicantRow[] | undefined;
  const threads = useQuery(api.messaging.listMyThreads) as ThreadSummary[] | undefined;
  const sendMessage = useMutation(api.messaging.sendMessage);
  const markRead = useMutation(api.messaging.markThreadRead);

  const sp = useSearchParams();
  // `?applicant=` accepts a user id or an application id (Applicants page links).
  const [selectedId, setSelectedId] = useState<string | null>(sp.get("applicant"));
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const contacts: Contact[] = useMemo(() => {
    const byUser = new Map<string, Contact>();
    for (const a of applicants ?? []) {
      const name = a.snapshot?.displayName ?? "Applicant";
      const stage = (STAGES as string[]).includes(a.stage) ? (a.stage as ApplicationStage) : "new";
      const existing = byUser.get(a.applicantId);
      if (existing) {
        existing.applicationIds.push(a._id);
        if (!existing.jobTitles.includes(a.jobTitle)) existing.jobTitles.push(a.jobTitle);
        if (a.createdAt > existing.appliedAt) {
          existing.appliedAt = a.createdAt;
          existing.stage = stage;
        }
        continue;
      }
      byUser.set(a.applicantId, {
        userId: a.applicantId,
        applicationIds: [a._id],
        name,
        initials:
          a.snapshot?.initials ??
          name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w.charAt(0).toUpperCase())
            .join(""),
        jobTitles: [a.jobTitle],
        appliedAt: a.createdAt,
        stage,
      });
    }
    return [...byUser.values()];
  }, [applicants]);

  const threadByUser = useMemo(
    () => new Map((threads ?? []).map((t) => [t.otherUserId, t])),
    [threads],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .filter((c) => !q || `${c.name} ${c.jobTitles.join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => {
        // Conversations first (most recent message), then newest applicants.
        const la = threadByUser.get(a.userId)?.lastMessageAt ?? 0;
        const lb = threadByUser.get(b.userId)?.lastMessageAt ?? 0;
        if (la || lb) return lb - la;
        return b.appliedAt - a.appliedAt;
      });
  }, [contacts, search, threadByUser]);

  const selected =
    contacts.find((c) => c.userId === selectedId || c.applicationIds.includes(selectedId ?? "")) ??
    visible[0] ??
    null;

  const conversation = useQuery(
    api.messaging.threadWith,
    selected ? { otherUserId: selected.userId as never } : "skip",
  );

  // Mark the open conversation read when new messages arrive.
  const openThreadId = conversation?.threadId ?? null;
  const openUnread = conversation?.unread ?? 0;
  useEffect(() => {
    if (openThreadId && openUnread > 0) {
      void markRead({ threadId: openThreadId as never });
    }
  }, [openThreadId, openUnread, markRead]);

  const send = async () => {
    const text = draft.trim();
    if (!selected || !text) return;
    setSending(true);
    try {
      await sendMessage({ recipientId: selected.userId as never, content: text });
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message not sent");
    } finally {
      setSending(false);
    }
  };

  const firstName = selected?.name.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reach out to alumni who applied to your postings. They can reply from
        their own Messages.
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
                aria-label="Search applicants"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {applicants === undefined ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : visible.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {contacts.length === 0 ? "No applicants yet." : "No matches."}
              </p>
            ) : (
              visible.map((c) => {
                const t = threadByUser.get(c.userId);
                const isSel = selected?.userId === c.userId;
                return (
                  <button
                    key={c.userId}
                    type="button"
                    onClick={() => setSelectedId(c.userId)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0",
                      isSel ? "bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {c.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        {t && (
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {fmtTime(t.lastMessageAt)}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="block truncate text-xs text-muted-foreground">
                          {t?.lastMessagePreview || c.jobTitles.join(", ")}
                        </span>
                        {t && t.unread > 0 && (
                          <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
                            {t.unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread */}
        {selected ? (
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {selected.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{selected.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  Applied to {selected.jobTitles.join(", ")} · {STAGE_LABEL[selected.stage]}
                </div>
              </div>
              <StageBadge stage={selected.stage} />
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/20 p-4">
              <p className="mx-auto max-w-sm rounded-md bg-muted px-3 py-1.5 text-center text-[11px] text-muted-foreground">
                Applied {fmtDate(selected.appliedAt)}. Messaging is available
                because {firstName} applied to your posting.
              </p>
              {conversation === undefined ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !conversation || conversation.messages.length === 0 ? (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  No messages yet — say hello.
                </p>
              ) : (
                conversation.messages.map((m) => (
                  <div key={m._id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                        m.mine ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border",
                      )}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      <div
                        className={cn(
                          "mt-0.5 text-[10px]",
                          m.mine ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {fmtTime(m.sentAt)}
                        {m.mine && m.readAt ? " · Read" : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-end gap-2 border-t border-border p-3">
              <Textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={
                  conversation && !conversation.allowed
                    ? "You can't message this person"
                    : `Message ${firstName}…`
                }
                disabled={!!conversation && !conversation.allowed}
                maxLength={4000}
                className="min-h-9 resize-none"
                aria-label={`Message ${selected.name}`}
              />
              <Button
                onClick={() => void send()}
                disabled={!draft.trim() || sending || (!!conversation && !conversation.allowed)}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
            {applicants === undefined ? "Loading…" : "No applicants to message yet."}
          </div>
        )}
      </div>
    </div>
  );
}
