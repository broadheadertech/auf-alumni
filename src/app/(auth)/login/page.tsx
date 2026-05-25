"use client";

/**
 * Sign-in page (ported from Claude Design prototype).
 * Split-screen with branded right rail; Convex Auth Password provider
 * stays the credential path. Google + AUF SSO buttons are placeholders for now.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { ArrowRight, GraduationCap, Lock } from "lucide-react";
import { LoginSchema, type LoginInput } from "@/lib/schemas/user";
import { AuthShell, Field } from "@/components/auf/AuthChrome";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);

  const form = useForm<LoginInput>({
    resolver: standardSchemaResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginInput) => {
    setSubmitting(true);
    try {
      await signIn("password", {
        email: values.email,
        password: values.password,
        flow: "signIn",
      });
      router.push("/welcome");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid email or password";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back."
      sub="Sign in to your AUF Alumni account to access jobs, mentors, and your batch network."
    >
      <button
        type="button"
        className="auf-btn auf-btn-outline w-full justify-center !py-3 !text-[14px] !font-medium mb-2.5"
        onClick={() => toast.info("Google sign-in coming soon")}
      >
        <GoogleGlyph />
        Continue with Google
      </button>
      <button
        type="button"
        className="auf-btn auf-btn-outline w-full justify-center !py-3 !text-[14px] !font-medium"
        style={{
          background: "var(--brand-deep)",
          color: "white",
          borderColor: "var(--brand-deep)",
        }}
        onClick={() => toast.info("AUF SSO coming soon")}
      >
        <GraduationCap size={15} /> Continue with AUF Student SSO
      </button>

      <Divider label="or with email" />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <Field label="Email or alumni ID" htmlFor="email">
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
        <Field
          label="Password"
          htmlFor="password"
          hint={
            <button
              type="button"
              className="text-[12px] brand-fg hover:underline font-medium"
              onClick={() => toast.info("Password reset coming soon")}
            >
              Forgot password?
            </button>
          }
        >
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="auf-input pr-12"
              aria-invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ink-3 hover:ink-2 font-medium"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {form.formState.errors.password && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </Field>

        <label className="flex items-center gap-2 text-[13px] ink-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 accent-[var(--brand)]"
          />
          Keep me signed in for 30 days
        </label>

        <button
          type="submit"
          className="auf-btn auf-btn-primary w-full justify-center !py-3 !text-[14px] mt-2"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : (
            <>
              Sign in <ArrowRight size={14} />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t auf-hairline text-center text-[13.5px] ink-2">
        New to AUF Alumni?
        <Link
          href="/signup"
          className="ml-1 brand-fg font-medium hover:underline"
        >
          Create an account →
        </Link>
      </div>

      <div
        className="mt-5 p-3 rounded-lg flex items-start gap-2.5 text-[12px] ink-2"
        style={{ background: "var(--surface-2)" }}
      >
        <Lock size={13} className="mt-0.5 ink-3" />
        <div>
          This network is exclusive to verified AUF alumni and approved partner
          employers. Identity is confirmed via the AUF registrar.
        </div>
      </div>
    </AuthShell>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-[var(--border-soft)]" />
      <div className="text-[11px] ink-3 uppercase tracking-wider">{label}</div>
      <div className="flex-1 h-px bg-[var(--border-soft)]" />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.4 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2.1 1.4-4.7 2.4-7.3 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.7-4.9 6.7-14.8 0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  );
}
