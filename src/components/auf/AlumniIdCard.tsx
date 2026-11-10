"use client";

/**
 * Admin Alumni ID card management (Convex-backed).
 *
 * The fixed RFID UID and the PIN are stored server-side as salted hashes only —
 * never the raw values. Admin binds the UID (from the reader) and emails the
 * alumna a one-time link to set her own PIN. Includes a checkpoint verify demo.
 */

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  CreditCard,
  ExternalLink,
  Lock,
  Mail,
  QrCode,
  RotateCcw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { CARD_STATUS_LABEL, alumniIdOf, type CardStatus } from "@/lib/id-cards";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<CardStatus, string> = {
  issued: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  lost: "bg-destructive/10 text-destructive",
};

/** Minimal shape the card needs — a real Convex profile satisfies this. */
export type AlumnaIdInput = {
  id: string;
  name: string;
  batch: number;
  program: string;
  initials: string;
  email: string;
  /** Real minted Alumni ID, if issued. Falls back to a derived display ID. */
  alumniId?: string | null;
};

/** Stable no-op: a value that never changes still needs a subscribe fn. */
const NO_SUBSCRIBE = () => () => {};

export function AlumniIdCard({ alumna }: { alumna: AlumnaIdInput }) {
  const card = useQuery(api.idCards.getCard, { alumnaId: alumna.id });
  const bindUid = useMutation(api.idCards.bindUid);
  const setStatus = useMutation(api.idCards.setStatus);
  const reissue = useMutation(api.idCards.reissue);
  const issueActivation = useMutation(api.idCards.issueActivation);

  // The display ID falls back to a derived value; the QR + scan preview use
  // ONLY the real minted ID (null until issued), so we never publish a QR that
  // resolves to nothing.
  const realId = alumna.alumniId ?? null;
  const alumniId = realId ?? alumniIdOf(alumna.id, alumna.batch);

  // The origin never changes, so there is nothing to subscribe to — the
  // point of useSyncExternalStore here is its third argument, the server
  // snapshot. That is what the effect was emulating: render "" on the server,
  // the real origin on the client, without a hydration mismatch.
  const origin = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => window.location.origin,
    () => "",
  );
  const verifyUrl = realId ? `${origin}/i/${realId}` : "";

  // Exactly what a scanner sees — same query the public /i/[id] page uses.
  const scan = useQuery(
    api.profiles.verifyAlumniId,
    realId ? { alumniId: realId } : "skip",
  );

  const [uidInput, setUidInput] = useState("");
  const [email, setEmail] = useState(alumna.email);
  const [sending, setSending] = useState(false);
  const [activationLink, setActivationLink] = useState<string | null>(null);
  const [vUid, setVUid] = useState("");
  const [vPin, setVPin] = useState("");
  const [vResult, setVResult] = useState<"idle" | "ok" | "fail">("idle");

  const status = (card?.status ?? null) as CardStatus | null;

  const onBind = async () => {
    if (!uidInput.trim()) {
      toast.error("Enter the card UID (tap the card on the reader)");
      return;
    }
    try {
      await bindUid({ alumnaId: alumna.id, uid: uidInput });
      toast.success("Card bound to " + alumna.name);
      setUidInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to bind");
    }
  };

  const onSendActivation = async () => {
    if (!email.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    setSending(true);
    try {
      const res = await issueActivation({
        alumnaId: alumna.id,
        alumnaName: alumna.name,
        email: email.trim(),
      });
      // withAuditLog returns the handler's `result`, typed as possibly
      // undefined. The email is sent by the mutation either way, so a missing
      // link only costs the admin the copyable URL — worth saying so rather
      // than claiming success and showing nothing.
      if (res?.url) {
        setActivationLink(res.url);
        toast.success(`Activation email sent to ${email.trim()}`);
      } else {
        toast.success(
          `Activation email sent to ${email.trim()} — the link could not be shown here`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  // verify() became a mutation so it can count failed attempts and lock the
  // card — a 4-digit PIN with no lockout was brute-forceable in minutes.
  const verifyCard = useMutation(api.idCards.verify);
  const onVerify = async () => {
    try {
      const result = await verifyCard({
        alumnaId: alumna.id,
        uid: vUid,
        pin: vPin,
      });
      setVResult(result.ok ? "ok" : "fail");
      if (!result.ok && result.reason === "locked") {
        toast.error("Too many wrong attempts — this card is locked for 15 minutes");
      } else if (!result.ok && result.reason === "needs-reactivation") {
        toast.error("This card predates the current security scheme — re-issue the PIN");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify");
      setVResult("fail");
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Alumni ID card</h2>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {/* Credential preview */}
          <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <div
              className="flex items-center justify-between px-4 py-2.5 text-white"
              style={{ background: "var(--brand-deep)" }}
            >
              <div className="leading-tight">
                <div className="font-serif text-[13px] font-semibold">
                  AUF Alumni Network
                </div>
                <div
                  className="text-[8.5px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--gold)" }}
                >
                  Official credential
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  status ? STATUS_TONE[status] : "bg-white/15 text-white",
                )}
              >
                {status ? CARD_STATUS_LABEL[status] : "No card"}
              </span>
            </div>
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-lg font-semibold ring-2 ring-[var(--gold)]">
                {alumna.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-base font-semibold">
                  {alumna.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {alumna.program} · Batch {alumna.batch}
                </div>
                <div className="mt-2 space-y-0.5 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Alumni ID </span>
                    <span className="font-mono">{alumniId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">RFID card </span>
                    <span className="font-mono">
                      {card?.hasUid ? "•••• bound (hidden)" : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PIN </span>
                    {card?.hasPin ? "•••• set" : "not set"}
                  </div>
                </div>
              </div>
              <div className="shrink-0 rounded-md bg-white p-1.5 ring-1 ring-border">
                {realId ? (
                  <QRCodeSVG
                    value={verifyUrl || `/i/${realId}`}
                    size={72}
                    level="M"
                    fgColor="#13193f"
                  />
                ) : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center text-center text-[8px] leading-tight text-muted-foreground">
                    ID not issued
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Management */}
          <div className="space-y-4">
            {/* RFID card */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <ScanLine className="h-3.5 w-3.5" /> Physical RFID card
              </div>
              {!card?.hasUid ? (
                <div className="mt-1.5 flex gap-2">
                  <Input
                    type="password"
                    value={uidInput}
                    onChange={(e) => setUidInput(e.target.value)}
                    placeholder="Focus, then tap card on the reader…"
                    className="font-mono text-xs"
                  />
                  <Button size="sm" onClick={onBind}>
                    Bind
                  </Button>
                </div>
              ) : (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                    <Lock className="h-3 w-3" /> Bound (hidden)
                  </span>
                  {status !== "lost" && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={async () => {
                        await setStatus({ alumnaId: alumna.id, status: "lost" });
                        toast.message("Card marked lost");
                      }}
                    >
                      Mark lost
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={async () => {
                      await reissue({ alumnaId: alumna.id });
                      setActivationLink(null);
                      toast.message("Card cleared — ready to reissue");
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reissue
                  </Button>
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Non-programmable card. Its fixed UID can only be read with the
                AUF RFID reader — most USB readers type it into the focused
                field. Reading &amp; binding are admin-only; alumni cannot
                self-register a card.
              </p>
            </div>

            {/* PIN via emailed activation */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Mail className="h-3.5 w-3.5" /> Security PIN (2nd factor)
              </div>
              {card?.hasPin ? (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Lock className="h-3.5 w-3.5" /> PIN set by the alumna · card
                  active
                </p>
              ) : (
                <>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    The alumna sets her own PIN via a one-time link — staff never
                    see it. Email it to her:
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alumna@email.com"
                      className="text-xs"
                    />
                    <Button size="sm" onClick={onSendActivation} disabled={sending}>
                      {sending ? "Sending…" : "Send"}
                    </Button>
                  </div>
                  {activationLink && (
                    <div className="mt-2 rounded-md border border-border bg-muted/40 p-2">
                      <div className="text-[11px] text-muted-foreground">
                        Emailed via Resend (single-use, 30-min expiry). Demo link:
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <a
                          href={activationLink}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 truncate font-mono text-[11px] text-primary hover:underline"
                        >
                          {activationLink}
                        </a>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label="Copy link"
                          onClick={() => {
                            navigator.clipboard?.writeText(activationLink);
                            toast.success("Link copied");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Checkpoint verify demo */}
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Checkpoint test (UID + PIN)
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                At a checkpoint the admin taps the card on the reader to fill the
                UID, then the alumna enters her PIN.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  type="password"
                  value={vUid}
                  onChange={(e) => { setVUid(e.target.value); setVResult("idle"); }}
                  placeholder="Tap card (UID)"
                  className="h-8 flex-1 font-mono text-xs"
                />
                <Input
                  type="password"
                  inputMode="numeric"
                  value={vPin}
                  onChange={(e) => { setVPin(e.target.value); setVResult("idle"); }}
                  placeholder="PIN"
                  className="h-8 w-20 text-xs"
                />
                <Button size="sm" onClick={onVerify}>
                  Verify
                </Button>
              </div>
              {vResult !== "idle" && (
                <p
                  className={cn(
                    "mt-2 text-xs font-medium",
                    vResult === "ok"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive",
                  )}
                >
                  {vResult === "ok"
                    ? `✓ Access granted — ${alumna.name}`
                    : "✗ Denied — UID or PIN does not match"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* What a scan reveals — the live public verification payload, the same
            one the /i/[id] page renders. Lets staff demo the scan result
            without a phone. */}
        {realId ? (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <QrCode className="h-3.5 w-3.5" /> What people see when they scan
                this
              </div>
              <a
                href={verifyUrl || `/i/${realId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                Open scan page <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {scan === undefined ? (
              <p className="mt-2 text-[11px] text-muted-foreground">Loading…</p>
            ) : scan?.ok ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-3">
                <ScanRow label="Name" value={scan.displayName} />
                <ScanRow label="Alumni ID" value={scan.alumniId} mono />
                <ScanRow
                  label="Batch"
                  value={`AUF '${String(scan.batch).slice(-2)}`}
                />
                <ScanRow label="Program" value={scan.program} />
                <ScanRow label="Degree" value={scan.degree} />
                <ScanRow
                  label="Issued"
                  value={new Date(scan.issuedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                />
              </dl>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                This ID isn&apos;t verifiable yet.
              </p>
            )}
            <p className="mt-2 text-[10.5px] text-muted-foreground">
              Public-tier facts only — private fields stay hidden. This is the
              live result of the QR&apos;s verification page.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-1.5 rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
            <QrCode className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              The Alumni ID isn&apos;t issued yet, so the QR can&apos;t be
              scanned. It&apos;s minted automatically when the alumna opens her
              digital ID page.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScanRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-0.5 font-medium", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
