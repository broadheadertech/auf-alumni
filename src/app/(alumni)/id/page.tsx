"use client";

/**
 * Virtual Alumni ID card.
 *
 * Shows the signed-in alumna a credential-style ID with name, batch,
 * program, college (derived from program), verified-since date, opaque
 * Alumni ID, and a QR code that links to `/verify/{alumniId}` so anyone
 * can confirm authenticity by scanning.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { api } from "@/lib/convex-api";
import { AUFAvatar } from "@/components/auf/AUFAvatar";

type Card = {
  _id: string;
  displayName: string;
  batch: number;
  program: string;
  degree: string;
  slug: string;
  city?: string;
  country?: string;
  verifiedAt?: number;
  alumniId?: string | null;
  alumniIdIssuedAt?: number | null;
  photoUrl?: string | null;
} | null;

function Field({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok";
}) {
  return (
    <div>
      <dt
        className="text-[9px] uppercase tracking-[0.14em]"
        style={{ color: "var(--ink-3)" }}
      >
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-[12.5px] font-medium ${mono ? "font-mono" : ""}`}
        style={tone === "ok" ? { color: "var(--gold-ink)" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function formatIssued(ms?: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AlumniIdPage() {
  const card = useQuery(api.profiles.getMyAlumniCard) as Card | undefined;
  const ensureId = useMutation(api.profiles.ensureMyAlumniId);
  const [minting, setMinting] = useState(false);

  // Lazily mint the ID the first time the page loads if not present.
  /* eslint-disable */
  useEffect(() => {
    if (
      card &&
      !card.alumniId &&
      card.verifiedAt != null &&
      !minting
    ) {
      setMinting(true);
      ensureId({})
        .catch((err) => {
          toast.error(
            err instanceof Error ? err.message : "Could not issue your ID",
          );
        })
        .finally(() => setMinting(false));
    }
  }, [card]);
  /* eslint-enable */

  if (card === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <Loader2 className="mx-auto h-6 w-6 animate-spin ink-3" />
      </div>
    );
  }

  if (card === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div className="auf-card p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold">No profile yet</h1>
          <p className="text-sm ink-3 mt-2">
            Create your profile before requesting your Alumni ID.
          </p>
        </div>
      </div>
    );
  }

  if (card.verifiedAt == null) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div className="auf-card p-8 text-center">
          <ShieldCheck size={28} className="mx-auto ink-3" />
          <h1 className="font-serif text-2xl font-semibold mt-3">
            Verification pending
          </h1>
          <p className="text-sm ink-3 mt-2 max-w-prose mx-auto">
            Your Alumni ID is issued automatically once your verification is
            approved. Most accounts are verified within 2 business days.
          </p>
        </div>
      </div>
    );
  }

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/i/${card.alumniId ?? ""}`
      : `/i/${card.alumniId ?? ""}`;

  const onPrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="section-eyebrow brand-fg">Digital credential</div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold mt-1">
            Your Alumni ID
          </h1>
        </div>
        <button
          type="button"
          onClick={onPrint}
          className="auf-btn auf-btn-outline auf-btn-sm"
          title="Save or print"
        >
          <Download size={14} />
          <span className="hidden sm:inline">Save</span>
        </button>
      </div>

      {/* The card */}
      <div className="print:shadow-none">
        <div
          className="rounded-xl overflow-hidden relative shadow-[0_2px_4px_-1px_rgba(0,0,0,0.08),0_8px_24px_-4px_rgba(0,0,0,0.12)] print:shadow-none"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
          }}
        >
          {/* ── Header band (navy + faint diagonal pattern + gold accent strip) ── */}
          <div
            className="relative px-5 sm:px-7 pt-5 sm:pt-6 pb-4"
            style={{ background: "var(--brand-deep)" }}
          >
            {/* faint diagonal stripes for credential feel */}
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              aria-hidden
              style={{
                background:
                  "repeating-linear-gradient(45deg, transparent 0 22px, rgba(255,255,255,0.5) 22px 23px)",
              }}
            />
            <div className="relative flex items-center gap-3">
              <div
                className="rounded-md p-1.5"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <Image
                  src="/auf-logo.png"
                  alt="Angeles University Foundation"
                  width={140}
                  height={32}
                  style={{ height: 26, width: "auto", display: "block" }}
                  priority
                />
              </div>
              <div className="leading-tight text-white">
                <div className="font-serif text-[15px] sm:text-[16px] font-semibold tracking-tight">
                  Alumni Network
                </div>
                <div
                  className="text-[9.5px] uppercase tracking-[0.2em] mt-0.5"
                  style={{ color: "var(--gold)" }}
                >
                  Official credential
                </div>
              </div>
              <div className="ml-auto">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: "var(--gold)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  <ShieldCheck size={12} />
                  Verified
                </span>
              </div>
            </div>
          </div>
          {/* Gold trim line */}
          <div
            aria-hidden
            style={{ height: 3, background: "var(--gold)" }}
          />

          {/* ── Body grid: photo + identity left, QR + meta right ── */}
          <div className="relative grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-5 sm:gap-7 px-5 sm:px-7 py-6 sm:py-7">
            {/* Faint AUF watermark */}
            <div
              className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
              aria-hidden
            >
              <span
                className="font-serif font-bold text-[140px] sm:text-[200px] leading-none whitespace-nowrap select-none"
                style={{ color: "var(--brand-deep)", opacity: 0.025 }}
              >
                AUF
              </span>
            </div>

            {/* Photo */}
            <div className="relative shrink-0 flex justify-center sm:justify-start">
              <div
                className="rounded-md overflow-hidden"
                style={{
                  width: 104,
                  height: 128,
                  background: "var(--surface-2)",
                  border: "2px solid var(--brand-deep)",
                  boxShadow: "0 0 0 4px var(--surface), 0 0 0 5px var(--gold)",
                }}
              >
                {card.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.photoUrl}
                    alt={card.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <AUFAvatar
                      name={card.displayName}
                      grad={1}
                      size={84}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Identity column */}
            <div className="relative min-w-0 flex flex-col">
              <div
                className="text-[10px] uppercase tracking-[0.16em] font-semibold"
                style={{ color: "var(--gold-ink)" }}
              >
                Verified alumnus / alumna
              </div>
              <h2 className="font-serif text-[24px] sm:text-[26px] font-semibold leading-tight mt-1 break-words">
                {card.displayName}
              </h2>
              <div className="text-[13.5px] ink-2 mt-1.5">
                {card.program}
              </div>
              <div className="text-[12px] ink-3 mt-0.5">
                {card.degree} · AUF Batch&nbsp;{card.batch}
              </div>

              <dl
                className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 pt-3"
                style={{ borderTop: "1px solid var(--border-soft)" }}
              >
                <Field
                  label="Alumni ID"
                  value={card.alumniId ?? (minting ? "Issuing…" : "—")}
                  mono
                />
                <Field
                  label="Issued"
                  value={formatIssued(card.alumniIdIssuedAt ?? card.verifiedAt)}
                />
                {(card.city || card.country) && (
                  <Field
                    label="Based in"
                    value={[card.city, card.country].filter(Boolean).join(", ")}
                  />
                )}
                <Field label="Status" value="Active" tone="ok" />
              </dl>
            </div>

            {/* QR column */}
            <div className="relative flex flex-col items-center sm:items-end gap-2">
              <div
                className="bg-white rounded-md p-2"
                style={{ border: "1px solid var(--border-strong)" }}
              >
                {card.alumniId ? (
                  <QRCodeSVG
                    value={verifyUrl}
                    size={108}
                    level="M"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#13193f"
                  />
                ) : (
                  <div className="w-[108px] h-[108px] flex items-center justify-center text-[10px] ink-3 text-center px-2">
                    Issuing…
                  </div>
                )}
              </div>
              <div
                className="text-[9.5px] uppercase tracking-[0.14em] font-semibold text-center sm:text-right"
                style={{ color: "var(--gold-ink)" }}
              >
                Scan to verify
              </div>
            </div>
          </div>

          {/* ── Footer band ── */}
          <div
            className="relative flex flex-wrap items-center gap-3 px-5 sm:px-7 py-3 text-[10.5px]"
            style={{
              borderTop: "1px solid var(--border-soft)",
              background: "var(--surface-2)",
              color: "var(--ink-3)",
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck
                size={12}
                style={{ color: "var(--gold-ink)" }}
              />
              Electronic + verifiable
            </span>
            <span aria-hidden>·</span>
            <span>Issued by Angeles University Foundation</span>
            <span className="ml-auto font-mono ink-3">
              auf.edu.ph/i/{card.alumniId ?? "…"}
            </span>
          </div>
        </div>
      </div>

      {/* Helper row */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] ink-3 print:hidden">
        <button
          type="button"
          onClick={onPrint}
          className="auf-btn auf-btn-outline auf-btn-sm"
        >
          <Download size={13} /> Save / print
        </button>
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="auf-btn auf-btn-ghost auf-btn-sm"
        >
          Open verification page ↗
        </a>
        {!card.alumniId && (
          <button
            type="button"
            onClick={() => {
              setMinting(true);
              ensureId({})
                .catch((err) =>
                  toast.error(
                    err instanceof Error ? err.message : "Failed",
                  ),
                )
                .finally(() => setMinting(false));
            }}
            disabled={minting}
            className="auf-btn auf-btn-primary auf-btn-sm"
          >
            <RefreshCw size={13} className={minting ? "animate-spin" : ""} />
            Issue my ID
          </button>
        )}
      </div>
    </div>
  );
}
