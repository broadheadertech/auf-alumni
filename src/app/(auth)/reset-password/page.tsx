"use client";

/**
 * Reset-password page.
 *
 * Reads `?token=...` from the URL and calls
 * `api.authResetHelpers.resetPassword`. Surfaces inline errors for the two
 * ConvexError codes the backend can throw (`invalid-token`, `weak-password`).
 * On success replaces the form with a confirmation that links back to /login.
 */

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { ArrowRight, Check, ShieldAlert } from "lucide-react";
import { api } from "@/lib/convex-api";
import { AuthShell, Field } from "@/components/auf/AuthChrome";

const MIN_PASSWORD_LENGTH = 12;
const REDIRECT_DELAY_MS = 1500;

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      sub="Your new password must be at least 12 characters. After updating, you'll be redirected to sign in."
    >
      <Suspense fallback={<div className="text-[13px] ink-3">Loading…</div>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const resetPassword = useAction(api.authResetHelpers.resetPassword);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [weakPassword, setWeakPassword] = useState<string | undefined>();

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    !submitting &&
    password.length >= MIN_PASSWORD_LENGTH &&
    confirm.length > 0 &&
    password === confirm;

  const helperText = useMemo(() => {
    if (tooShort) {
      return `${password.length}/${MIN_PASSWORD_LENGTH} characters`;
    }
    return `${MIN_PASSWORD_LENGTH}+ characters`;
  }, [tooShort, password.length]);

  if (!token) {
    return (
      <div
        className="p-5 rounded-lg flex items-start gap-3"
        style={{ background: "var(--surface-2)" }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--brand-deep)", color: "white" }}
        >
          <ShieldAlert size={16} />
        </div>
        <div>
          <div className="font-serif text-[18px] font-semibold leading-tight">
            No reset token in this URL
          </div>
          <p className="text-[13.5px] ink-2 mt-1.5 leading-[1.55]">
            This page needs a one-time reset token from the link in your email.
            Request a fresh link to continue.
          </p>
          <Link
            href="/forgot-password"
            className="auf-btn auf-btn-primary inline-flex mt-4 !py-2 !px-4 !text-[13px]"
          >
            Request a reset link <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  if (tokenInvalid) {
    return (
      <div
        className="p-5 rounded-lg flex items-start gap-3"
        style={{ background: "var(--surface-2)" }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--brand-deep)", color: "white" }}
        >
          <ShieldAlert size={16} />
        </div>
        <div>
          <div className="font-serif text-[18px] font-semibold leading-tight">
            This reset link is invalid or expired
          </div>
          <p className="text-[13.5px] ink-2 mt-1.5 leading-[1.55]">
            Reset links are single-use and expire 30 minutes after they&apos;re
            sent. Request a new one to continue.
          </p>
          <Link
            href="/forgot-password"
            className="auf-btn auf-btn-primary inline-flex mt-4 !py-2 !px-4 !text-[13px]"
          >
            Request a new link <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <div
          className="p-5 rounded-lg flex items-start gap-3"
          style={{ background: "var(--surface-2)" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--brand)", color: "white" }}
          >
            <Check size={16} />
          </div>
          <div>
            <div className="font-serif text-[18px] font-semibold leading-tight">
              Password updated
            </div>
            <p className="text-[13.5px] ink-2 mt-1.5 leading-[1.55]">
              You can now sign in with your new password. Redirecting you to
              sign in…
            </p>
          </div>
        </div>
        <div className="mt-6 text-center text-[13.5px] ink-2">
          <Link
            href="/login"
            className="brand-fg font-medium hover:underline"
          >
            Go to sign in →
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setWeakPassword(undefined);
    try {
      await resetPassword({ token, newPassword: password });
      toast.success("Password updated. Sign in with your new password.");
      setDone(true);
      setTimeout(() => router.push("/login"), REDIRECT_DELAY_MS);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string; message?: string };
        if (data?.code === "invalid-token") {
          setTokenInvalid(true);
          return;
        }
        if (data?.code === "weak-password") {
          setWeakPassword(
            data.message ??
              `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          );
          return;
        }
      }
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <Field
        label="New password"
        htmlFor="password"
        hint={<span className="text-[11px] ink-3">{helperText}</span>}
      >
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            placeholder="••••••••"
            className="auf-input pr-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={tooShort || !!weakPassword}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ink-3 hover:ink-2 font-medium"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {tooShort && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            Password must be at least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
        {weakPassword && !tooShort && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {weakPassword}
          </p>
        )}
      </Field>

      <Field label="Confirm new password" htmlFor="confirm">
        <div className="relative">
          <input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            className="auf-input pr-12"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ink-3 hover:ink-2 font-medium"
          >
            {showConfirm ? "Hide" : "Show"}
          </button>
        </div>
        {mismatch && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            Passwords don&apos;t match.
          </p>
        )}
      </Field>

      <button
        type="submit"
        className="auf-btn auf-btn-primary w-full justify-center !py-3 !text-[14px] mt-2"
        disabled={!canSubmit}
      >
        {submitting ? "Updating…" : (
          <>
            Update password <ArrowRight size={14} />
          </>
        )}
      </button>

      <div className="pt-4 text-center text-[13px] ink-2">
        <Link
          href="/login"
          className="brand-fg font-medium hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    </form>
  );
}
