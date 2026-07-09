"use client";

/**
 * Alumni ID PIN activation — reached from the "set your PIN" email link.
 *
 * The one-time token (Convex, single-use, 30-min TTL) proves it's the right
 * alumna, so this page needs no login. She sets a PIN she keeps private (only a
 * salted hash is stored server-side; staff never see it). The card flips to
 * Active. Works cross-device — the token lives in Convex, not the browser.
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ActivateIdPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f3ee] px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">
            AUF
          </span>
          <span className="text-sm font-semibold">Alumni ID activation</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Inner() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const activation = useQuery(api.idCards.getActivation, { token });
  const activate = useMutation(api.idCards.activate);

  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Shell>
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="mt-3 text-lg font-semibold">Your ID is active</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your PIN is set. Tap your card and enter your PIN at AUF
            checkpoints. Keep your PIN private.
          </p>
          <Link
            href="/id"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            View my digital ID →
          </Link>
        </div>
      </Shell>
    );
  }

  if (activation === undefined) {
    return (
      <Shell>
        <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-muted-foreground" />
      </Shell>
    );
  }

  if (!activation.found || activation.used) {
    return (
      <Shell>
        <div className="py-4 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 text-lg font-semibold">Link not valid</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activation.used
              ? "This activation link has already been used."
              : "This activation link is invalid or has expired. Ask AUF to reissue it."}
          </p>
        </div>
      </Shell>
    );
  }

  const submit = async () => {
    const clean = pin.replace(/\D/g, "");
    if (clean.length < 4) {
      toast.error("PIN must be 4–6 digits");
      return;
    }
    if (clean !== confirm.replace(/\D/g, "")) {
      toast.error("PINs don't match");
      return;
    }
    setBusy(true);
    try {
      const r = await activate({ token, pin: clean });
      if (r.ok) setDone(true);
      else
        toast.error(
          r.reason === "expired"
            ? "This link has expired — ask AUF to reissue it."
            : r.reason === "used"
              ? "This link was already used."
              : "Could not activate.",
        );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="mb-4 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <div className="text-sm">
          <div className="font-medium">{activation.alumnaName}</div>
          <div className="text-xs text-muted-foreground">Set your ID PIN</div>
        </div>
      </div>

      <h1 className="text-lg font-semibold">Set your ID PIN</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This 4–6 digit PIN is your second security factor. Only you should know
        it — AUF staff can&apos;t see it.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium">New PIN</label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="4–6 digits"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Confirm PIN</label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter PIN"
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={busy}>
          {busy ? "Activating…" : "Activate my ID"}
        </Button>
      </div>
    </Shell>
  );
}
