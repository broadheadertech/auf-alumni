/**
 * Public Alumni ID verification page. Anyone with the QR (or the URL) can
 * land here and confirm the ID is real + which alumna it belongs to. No
 * private profile fields are exposed; the underlying query returns just
 * verification status + public-tier facts.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { ShieldCheck, ShieldX } from "lucide-react";
import { api } from "@/lib/convex-api";

type Params = Promise<{ alumniId: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { alumniId } = await params;
  return {
    title: `Verify Alumni ID ${alumniId} — AUF Alumni Network`,
    robots: "noindex",
  };
}

type VerificationResult =
  | { ok: false }
  | {
      ok: true;
      alumniId: string;
      displayName: string;
      slug: string;
      batch: number;
      program: string;
      degree: string;
      issuedAt: number;
    };

export default async function VerifyAlumniIdPage({
  params,
}: {
  params: Params;
}) {
  const { alumniId } = await params;
  let result: VerificationResult = { ok: false };
  try {
    result = (await fetchQuery(api.profiles.verifyAlumniId, {
      alumniId,
    })) as VerificationResult;
  } catch {
    // Convex unavailable — fall through to "not found" state.
  }

  if (!result.ok) {
    return (
      <div className="max-w-[680px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
        <div className="auf-card p-8 text-center">
          <ShieldX size={32} className="mx-auto ink-3" />
          <h1 className="font-serif text-2xl font-semibold mt-3">
            ID not recognised
          </h1>
          <p className="text-sm ink-3 mt-2">
            <span className="font-mono">{alumniId}</span> does not match a
            verified alumna on file. If you scanned this code from a printed
            ID, ask the holder to issue a fresh one in their account.
          </p>
          <Link
            href="/"
            className="auf-btn auf-btn-outline auf-btn-sm mt-4 inline-flex"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  const issued = new Date(result.issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-[680px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3 text-center">
        Alumni ID verification
      </div>
      <div className="auf-card p-6 sm:p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full brand-50 brand-fg flex items-center justify-center">
          <ShieldCheck size={28} />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold mt-3">
          Verified alumna
        </h1>
        <p className="text-sm ink-3 mt-1">
          This ID was issued by the AUF Alumni Network and is currently valid.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-left text-[13px]">
          <Row label="Name" value={result.displayName} />
          <Row label="Alumni ID" value={result.alumniId} mono />
          <Row
            label="Batch"
            value={`AUF '${String(result.batch).slice(-2)}`}
          />
          <Row label="Program" value={result.program} />
          <Row label="Degree" value={result.degree} />
          <Row label="Issued" value={issued} />
        </dl>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href={`/u/${result.slug}`}
            className="auf-btn auf-btn-outline auf-btn-sm"
          >
            View public profile →
          </Link>
        </div>

        <p className="text-[11px] ink-3 mt-6 max-w-prose mx-auto">
          The information shown above is public per the alumna&apos;s privacy
          settings. Any field not displayed is restricted to alumni-only or
          connection-only views.
        </p>
      </div>
    </div>
  );
}

function Row({
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
      <dt className="text-[10px] uppercase tracking-wider ink-3">{label}</dt>
      <dd className={`mt-0.5 font-medium ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
