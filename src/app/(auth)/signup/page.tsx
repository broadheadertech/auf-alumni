"use client";

/**
 * Sign-up page (ported from Claude Design prototype).
 *
 * Wraps the design's split-screen + branded rail around the real Convex Auth
 * signup flow (Password provider → bootstrapAfterSignup → tryFastPathVerify).
 * The design's 3-step UI is preserved visually; only Step 1 actually creates
 * the account in v1, then the alumna proceeds to the existing /verify flow.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { Controller, useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { ArrowRight, Check, GraduationCap } from "lucide-react";
import { SignupSchema, type SignupInput } from "@/lib/schemas/user";
import { api } from "@/lib/convex-api";
import { AuthShell, Field } from "@/components/auf/AuthChrome";

const PRIVACY_NOTICE_VERSION = "1.0";

export default function SignupPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const bootstrap = useMutation(api.users.bootstrapAfterSignup);
  const tryFastPath = useMutation(api.verification.tryFastPathVerify);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SignupInput>({
    resolver: standardSchemaResolver(SignupSchema),
    defaultValues: { email: "", password: "", consentAcknowledged: false },
  });

  const onSubmit = async (values: SignupInput) => {
    setSubmitting(true);
    try {
      await signIn("password", {
        email: values.email,
        password: values.password,
        flow: "signUp",
      });
      await bootstrap({ consentVersion: PRIVACY_NOTICE_VERSION });
      try {
        await tryFastPath({
          claimedName: values.email.split("@")[0],
          claimedBatch: new Date().getFullYear(),
          claimedProgram: "BS Information Technology",
        });
      } catch {
        // non-fatal — alumna proceeds to manual verification next
      }
      toast.success("Welcome! Let's get you verified.");
      router.push("/verify");
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
      title="Join your batch."
      sub="Free for all AUF alumni. Takes about 2 minutes."
      rail={<SignupRail />}
    >
      <Stepper current={1} />

      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          type="button"
          className="auf-btn auf-btn-outline justify-center !py-3 !text-[13px] !font-medium"
          onClick={() => toast.info("Google sign-up coming soon")}
        >
          <GoogleGlyph small />
          Google
        </button>
        <button
          type="button"
          className="auf-btn auf-btn-outline justify-center !py-3 !text-[13px] !font-medium"
          onClick={() => toast.info("AUF SSO coming soon")}
        >
          <GraduationCap size={14} /> AUF SSO
        </button>
      </div>

      <Divider label="or use email" />

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-3"
        noValidate
      >
        <Field label="Email" htmlFor="email" hint={
          <span className="text-[11px] ink-3">Personal email — we&apos;ll match it to your AUF record</span>
        }>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="lara.mendoza@email.com"
            className="auf-input"
            aria-invalid={!!form.formState.errors.email}
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </Field>
        <Field label="Password" htmlFor="password" hint={
          <span className="text-[11px] ink-3">12+ characters, your choice</span>
        }>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="auf-input"
            aria-invalid={!!form.formState.errors.password}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </Field>

        <Controller
          control={form.control}
          name="consentAcknowledged"
          render={({ field }) => (
            <label className="flex items-start gap-2 text-[12.5px] ink-2 cursor-pointer pt-2">
              <input
                id="consent"
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[var(--brand)]"
              />
              <span>
                I acknowledge the{" "}
                <Link href="/legal/privacy" className="brand-fg hover:underline">
                  privacy notice
                </Link>
                {" "}(Philippine Data Privacy Act) and confirm I am an AUF alum,
                current student, or approved employer.
              </span>
            </label>
          )}
        />
        {form.formState.errors.consentAcknowledged && (
          <p role="alert" className="text-xs text-destructive">
            {form.formState.errors.consentAcknowledged.message}
          </p>
        )}

        <button
          type="submit"
          className="auf-btn auf-btn-primary w-full justify-center !py-3 !text-[14px] mt-4"
          disabled={submitting}
        >
          {submitting ? "Creating account…" : (
            <>
              Continue to verification <ArrowRight size={14} />
            </>
          )}
        </button>
      </form>

      <div className="mt-5 text-center text-[13px] ink-2">
        Already have an account?
        <Link href="/login" className="ml-1 brand-fg font-medium hover:underline">
          Sign in →
        </Link>
      </div>
    </AuthShell>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-3 mb-7">
      {[1, 2, 3].map((n, i) => (
        <div key={n} className="contents">
          <div className={`flex items-center gap-2 ${n === current ? "ink" : "ink-3"}`}>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${n < current || n === current ? "text-white" : "border auf-hairline"}`}
              style={{
                background: n <= current ? "var(--brand)" : "transparent",
                borderColor: "var(--border-soft)",
              }}
            >
              {n < current ? <Check size={12} /> : n}
            </div>
            <span className="text-[12.5px] font-medium hidden sm:inline">
              {n === 1 ? "Account" : n === 2 ? "Verify" : "Done"}
            </span>
          </div>
          {i < 2 && (
            <div
              className="flex-1 h-px"
              style={{ background: n < current ? "var(--brand)" : "var(--border-soft)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-[var(--border-soft)]" />
      <div className="text-[11px] ink-3 uppercase tracking-wider">{label}</div>
      <div className="flex-1 h-px bg-[var(--border-soft)]" />
    </div>
  );
}

function GoogleGlyph({ small }: { small?: boolean }) {
  const s = small ? 14 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.4 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2.1 1.4-4.7 2.4-7.3 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.7-4.9 6.7-14.8 0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  );
}

function SignupRail() {
  return (
    <div className="mt-auto">
      <div className="section-eyebrow mb-4" style={{ color: "var(--gold)" }}>
        What you unlock
      </div>
      <ul className="space-y-3.5">
        {([
          ["Verified batchmate directory", "Search 38K+ classmates by college, year, location, industry."],
          ["Jobs with insider intros", "Every posting shows who from AUF works there. DM them directly."],
          ["Mentorship in 2 clicks", "Senior alums offering office hours, mock interviews, portfolio reviews."],
          ["Verified events", "Reunions, panels, mixers — RSVP'd by people you actually know."],
        ] as Array<[string, string]>).map(([t, d], i) => (
          <li key={t} className="flex gap-3 items-start">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
              style={{ background: "rgba(255,255,255,0.1)", color: "var(--gold)" }}
            >
              {i + 1}
            </div>
            <div>
              <div className="text-[14.5px] font-medium">{t}</div>
              <div className="text-[12.5px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                {d}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
