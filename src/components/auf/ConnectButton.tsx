"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Loader2,
  MessageSquare,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  /** The other user's userId (the profile owner). */
  otherUserId: string;
  /** Optional className applied to the outer container. */
  className?: string;
};

const NOTE_MAX = 200;

/**
 * State-aware connection action. Sources state from
 * api.connections.stateWith and updates the connection graph via the
 * connections.ts mutations. The component is the same across surfaces — the
 * state machine adapts the rendered UI per Story 5 ACs.
 */
export function ConnectButton({ otherUserId, className }: Props) {
  const state = useQuery(api.connections.stateWith, {
    otherUserId: otherUserId as unknown as never,
  });
  const sendRequest = useMutation(api.connections.sendRequest);
  const accept = useMutation(api.connections.accept);
  const decline = useMutation(api.connections.decline);
  const withdraw = useMutation(api.connections.withdraw);
  const block = useMutation(api.connections.block);

  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!state) {
    return (
      <Button disabled className={className}>
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        Loading…
      </Button>
    );
  }

  if (state.kind === "self" || state.kind === "blocked") {
    return null;
  }

  if (state.kind === "not-authenticated") {
    return (
      <Button disabled className={className} title="Sign in to connect">
        Connect
      </Button>
    );
  }

  const handleSend = async () => {
    setBusy(true);
    try {
      await sendRequest({
        recipientId: otherUserId as unknown as never,
        note: note.trim() || undefined,
      });
      toast.success("Connection requested");
      setNoteOpen(false);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    } finally {
      setBusy(false);
    }
  };

  const handleAction =
    (fn: () => Promise<unknown>, success: string) => async () => {
      setBusy(true);
      try {
        await fn();
        toast.success(success);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    };

  if (state.kind === "connected") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          aria-label="Connected. Open actions menu"
        >
          <Check className="h-4 w-4 text-[var(--color-success)]" />
          Connected
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem disabled>
            <MessageSquare className="mr-2 h-4 w-4" />
            Message (Phase 2)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleAction(
              () =>
                block({ otherUserId: otherUserId as unknown as never }),
              "User blocked",
            )}
            className="text-destructive"
          >
            <UserMinus className="mr-2 h-4 w-4" />
            Block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (state.kind === "request-sent") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 text-muted-foreground" />
          )}
          Requested
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={handleAction(
              () =>
                withdraw({
                  connectionId: state.connectionId as unknown as never,
                }),
              "Request withdrawn",
            )}
          >
            <X className="mr-2 h-4 w-4" />
            Withdraw request
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (state.kind === "request-received") {
    return (
      <div className={className + " flex gap-2"}>
        <Button
          size="sm"
          disabled={busy}
          onClick={handleAction(
            () =>
              accept({
                connectionId: state.connectionId as unknown as never,
              }),
            "Connected",
          )}
        >
          {busy ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1 h-3.5 w-3.5" />
          )}
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={handleAction(
            () =>
              decline({
                connectionId: state.connectionId as unknown as never,
              }),
            "Request declined",
          )}
        >
          Decline
        </Button>
      </div>
    );
  }

  // not-connected
  if (noteOpen) {
    return (
      <div className={"flex flex-col gap-2 " + (className ?? "")}>
        <Textarea
          rows={2}
          maxLength={NOTE_MAX}
          placeholder="Optional: a short note (200 chars max)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNoteOpen(false);
              setNote("");
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSend} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="mr-1 h-3.5 w-3.5" />
            )}
            Send request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => setNoteOpen(true)}
      className={className}
      disabled={busy}
    >
      <UserPlus className="mr-1 h-3.5 w-3.5" />
      Connect
    </Button>
  );
}
