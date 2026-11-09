"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/auf/EmptyState";
import { cn } from "@/lib/utils";

type Thread = {
  threadId: string;
  otherUserId: string;
  otherName: string;
  otherSlug: string | null;
  lastMessageAt: number;
  lastMessagePreview: string;
  unread: number;
};

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-10" />}>
      <MessagesInner />
    </Suspense>
  );
}

function MessagesInner() {
  const me = useQuery(api.users.getMe);
  // `?to=<userId>` opens (or starts) a conversation with that person —
  // used by Connect/Message buttons on profiles, the feed and mentors.
  const sp = useSearchParams();
  const toUserId = sp.get("to");
  const threads = useQuery(api.messaging.listMyThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const thread = useQuery(
    api.messaging.getThread,
    activeThreadId
      ? { threadId: activeThreadId as unknown as never }
      : "skip",
  );
  const pending = useQuery(
    api.messaging.threadWith,
    toUserId ? { otherUserId: toUserId as unknown as never } : "skip",
  );
  const markRead = useMutation(api.messaging.markThreadRead);
  const sendMessage = useMutation(api.messaging.sendMessage);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Auto-select first thread on initial load
  const list = (threads ?? []) as Thread[];
  const firstThreadId = list[0]?.threadId ?? null;
  const pendingThreadId = pending?.threadId ?? null;
  /* eslint-disable */
  useEffect(() => {
    if (toUserId) {
      // Wait for threadWith: an existing conversation opens, a new one stays
      // on the composer below.
      if (pendingThreadId && activeThreadId !== pendingThreadId) {
        setActiveThreadId(pendingThreadId);
      }
      return;
    }
    if (!activeThreadId && firstThreadId) {
      setActiveThreadId(firstThreadId);
    }
  }, [activeThreadId, firstThreadId, toUserId, pendingThreadId]);
  /* eslint-enable */

  // Mark read when thread opens
  useEffect(() => {
    if (activeThreadId) {
      void markRead({ threadId: activeThreadId as unknown as never });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  const recipientId = thread?.otherUserId ?? toUserId ?? null;
  const startingNew = !!toUserId && !pendingThreadId;

  const onSend = async () => {
    if (!draft.trim() || !recipientId) return;
    setSending(true);
    try {
      await sendMessage({
        recipientId: recipientId as unknown as never,
        content: draft.trim(),
      });
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (threads === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Thread list — hide on mobile when a thread is active so the thread view fills the screen */}
        <aside
          className={cn(
            "space-y-1",
            activeThreadId && "hidden lg:block",
          )}
        >
          {list.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                No conversations yet. Connect with someone in the directory to
                start one.
              </CardContent>
            </Card>
          ) : (
            list.map((t) => (
              <button
                key={t.threadId}
                type="button"
                onClick={() => setActiveThreadId(t.threadId)}
                className={cn(
                  "w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted",
                  activeThreadId === t.threadId && "bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{t.otherName}</span>
                  {t.unread > 0 && (
                    <span className="ml-2 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                      {t.unread}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {t.lastMessagePreview}
                </div>
              </button>
            ))
          )}
        </aside>

        {/* Active thread */}
        <section className="flex flex-col">
          {thread === undefined && activeThreadId ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading…
              </CardContent>
            </Card>
          ) : startingNew ? (
            <NewConversation
              name={pending?.otherName ?? "this person"}
              allowed={pending?.allowed !== false}
              draft={draft}
              setDraft={setDraft}
              sending={sending}
              onSend={onSend}
            />
          ) : !thread ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Select a conversation.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <button
                  type="button"
                  onClick={() => setActiveThreadId(null)}
                  className="lg:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Back to conversations"
                >
                  <span aria-hidden>←</span>
                </button>
                <h2 className="text-sm font-medium">
                  {thread.otherSlug ? (
                    <Link
                      href={`/profile/${thread.otherSlug}`}
                      className="hover:underline"
                    >
                      {thread.otherName ?? "Conversation"}
                    </Link>
                  ) : (
                    (thread.otherName ?? "Conversation")
                  )}
                </h2>
              </div>
              <div className="my-3 flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: "60vh" }}>
                {thread.messages.length === 0 ? (
                  <EmptyState
                    message="Start the conversation"
                    description="Be specific — busy alumni respond more often to messages that lead with the ask."
                  />
                ) : (
                  (thread.messages as Array<{
                    _id: string;
                    senderId: string;
                    content: string;
                    sentAt: number;
                    readAt?: number;
                  }>).map((m) => {
                    const isMine = me && m.senderId === me._id;
                    return (
                      <div
                        key={m._id}
                        className={cn(
                          "flex",
                          isMine ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                            isMine
                              ? "bg-foreground text-background"
                              : "bg-muted",
                          )}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              isMine
                                ? "text-background/70"
                                : "text-muted-foreground",
                            )}
                          >
                            {new Date(m.sentAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2 border-t border-border pt-3">
                <Textarea
                  rows={2}
                  maxLength={4000}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.metaKey || e.ctrlKey) &&
                      !sending &&
                      draft.trim()
                    ) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={onSend}
                  disabled={!draft.trim() || sending}
                  className="self-end"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Composer for a conversation that doesn't exist yet (`?to=<userId>`). */
function NewConversation({
  name,
  allowed,
  draft,
  setDraft,
  sending,
  onSend,
}: {
  name: string;
  allowed: boolean;
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  onSend: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="text-sm font-medium">Message {name}</h2>
        {allowed ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              This starts a new conversation. Be specific — busy alumni respond
              more often to messages that lead with the ask.
            </p>
            <Textarea
              rows={4}
              value={draft}
              maxLength={4000}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Write to ${name}…`}
              className="mt-3"
              aria-label={`Message ${name}`}
            />
            <div className="mt-2 flex justify-end">
              <Button onClick={onSend} disabled={!draft.trim() || sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            You can message verified alumni, and employers whose postings you
            applied to. {name} can&apos;t be messaged right now — they may have
            blocked you or left the network.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
