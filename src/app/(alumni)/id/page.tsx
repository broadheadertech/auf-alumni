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
          className="auf-card overflow-hidden relative"
          style={{ aspectRatio: "1.586 / 1" }}
        >
          {/* Navy band */}
          <div
            className="absolute inset-x-0 top-0 h-16 sm:h-20 flex items-center px-4 sm:px-6 gap-3"
            style={{ background: "var(--brand-deep)" }}
          >
            <div
              className="rounded-md px-2 py-1.5"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <Image
                src="/auf-logo.png"
                alt="Angeles University Foundation"
                width={120}
                height={28}
                style={{ height: 22, width: "auto", display: "block" }}
              />
            </div>
            <div className="leading-tight text-white">
              <div className="font-serif text-[14px] font-semibold tracking-tight">
                Alumni Network
              </div>
              <div
                className="text-[9px] uppercase tracking-[0.18em]"
                style={{ color: "var(--gold)" }}
              >
                Verified Alumnus / Alumna ID
              </div>
            </div>
            <div className="ml-auto text-right">
              <div
                className="auf-chip auf-chip-verified !text-[10px] !bg-white/15 !text-white !border-white/30"
              >
                <ShieldCheck size={11} /> Verified
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="absolute inset-0 pt-16 sm:pt-20 px-4 sm:px-6 pb-4 sm:pb-6 flex gap-4 sm:gap-6">
            {/* Photo or initials */}
            <div className="shrink-0 flex flex-col items-center justify-start gap-2">
              {card.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.photoUrl}
                  alt={card.displayName}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-md object-cover ring-2 ring-(--brand-50)"
                />
              ) : (
                <AUFAvatar
                  name={card.displayName}
                  grad={1}
                  size={96}
                  ring
                  badge
                />
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="font-serif text-[18px] sm:text-[22px] font-semibold leading-tight">
                {card.displayName}
              </div>
              <div className="text-[12px] sm:text-[13px] ink-2 mt-0.5">
                {card.program}
              </div>
              <div className="text-[11px] sm:text-[12px] ink-3">
                {card.degree} · AUF Batch {card.batch}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:text-[12px]">
                <div>
                  <dt className="ink-3 uppercase tracking-wider text-[9px]">
                    Alumni ID
                  </dt>
                  <dd className="font-mono font-medium mt-0.5">
                    {card.alumniId ?? (minting ? "Issuing…" : "—")}
                  </dd>
                </div>
                <div>
                  <dt className="ink-3 uppercase tracking-wider text-[9px]">
                    Issued
                  </dt>
                  <dd className="font-medium mt-0.5">
                    {formatIssued(card.alumniIdIssuedAt ?? card.verifiedAt)}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto pt-3 flex items-end justify-between gap-2">
                <div className="text-[9px] ink-3 leading-tight max-w-[20ch]">
                  This ID is electronic and verifiable. Scan the code to
                  confirm authenticity.
                </div>
                <div className="bg-white p-1 rounded-sm">
                  {card.alumniId ? (
                    <QRCodeSVG
                      value={verifyUrl}
                      size={72}
                      level="M"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#13193f"
                    />
                  ) : (
                    <div className="w-[72px] h-[72px] flex items-center justify-center text-[9px] ink-3 text-center px-1">
                      Issuing…
                    </div>
                  )}
                </div>
              </div>
            </div>
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
