"use client";

/**
 * Forgot-password page.
 *
 * Single email field that calls `api.authResetHelpers.requestPasswordReset`.
 * Backend always returns `{ ok: true }` to avoid revealing whether an account
 * exists; we mirror that here by always showing the same "check your email"
 * confirmation. While `RESEND_API_KEY` isn't wired the action returns a
 * `resetUrl` so the demo flow still works — we surface it as a "Dev mode"
 * link directly under the confirmation when present.
 */

import { useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { ArrowRight, Mail } from "lucide-react";
import { api } from "@/lib/convex-api";
import { AuthShell, Field } from "@/components/auf/AuthChrome";

export default function ForgotPasswordPage() {
  const requestReset = useAction(api.authResetHelpers.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | undefined>();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const result = await requestReset({ email: trimmed });
      setDevResetUrl(result.resetUrl);
      setSent(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      sub="Type the email you used to sign up. We'll send a one-time reset link if it matches an account on file."
    >
      {sent ? (
        <div>
          <div
            className="p-5 rounded-lg flex items-start gap-3"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--brand)", color: "white" }}
            >
              <Mail size={16} />
            </div>
            <div>
              <div className="font-serif text-[18px] font-semibold leading-tight">
                Check your email
              </div>
              <p className="text-[13.5px] ink-2 mt-1.5 leading-[1.55]">
                If <span className="font-medium">{email}</span> matches an
                account, we&apos;ve sent a reset link. The link is single-use
                and expires in 30 minutes.
              </p>
              <p className="text-[12.5px] ink-3 mt-2">
                Didn&apos;t get it? Check spam, or{" "}
                <button
                  type="button"
                  className="brand-fg hover:underline font-medium"
                  onClick={() => {
                    setSent(false);
                    setDevResetUrl(undefined);
                  }}
                >
                  try a different email
                </button>
                .
              </p>
            </div>
          </div>

          {devResetUrl && (
            <div className="mt-3 text-[12px] ink-3">
              <span className="uppercase tracking-wider mr-2">Dev mode:</span>
              <Link
                href={devResetUrl.replace(/^https?:\/\/[^/]+/, "")}
                className="brand-fg hover:underline font-medium break-all"
              >
                open reset link
              </Link>
            </div>
          )}

          <div className="mt-6 pt-5 border-t auf-hairline text-center text-[13.5px] ink-2">
            <Link
              href="/login"
              className="brand-fg font-medium hover:underline"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="lara.mendoza@email.com"
                className="auf-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>

            <button
              type="submit"
              className="auf-btn auf-btn-primary w-full justify-center !py-3 !text-[14px] mt-2"
              disabled={submitting || !email.trim()}
            >
              {submitting ? "Sending…" : (
                <>
                  Send reset link <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t auf-hairline text-center text-[13.5px] ink-2">
            Remembered it?
            <Link
              href="/login"
              className="ml-1 brand-fg font-medium hover:underline"
            >
              Back to sign in →
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
