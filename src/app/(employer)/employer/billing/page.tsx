"use client";

/**
 * Employer billing (Epic 16).
 *
 * Surfaces the active subscription (if any), recent webhook events, and a
 * "Start checkout" button that hits Convex `startCheckout` and redirects the
 * browser to the returned URL. In v1 the URL is a placeholder loop-back so the
 * end-to-end flow is testable before a live processor (Stripe / PayMongo /
 * Maya) is wired in.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/auf/EmptyState";

const PLAN_TIERS = [
  { value: "starter", label: "Starter — 1 post / mo" },
  { value: "growth", label: "Growth — 5 posts / mo" },
  { value: "scale", label: "Scale — unlimited" },
];

export default function EmployerBillingPage() {
  type EmployerOrg = { _id: string; name: string };
  const employersRaw = useQuery(api.employerOrgs.listMine);
  const employers = (employersRaw ?? null) as EmployerOrg[] | null;
  const [employerOrgId, setEmployerOrgId] = useState<string | null>(null);
  const billing = useQuery(
    api.billing.getMyBilling,
    employerOrgId
      ? { employerOrgId: employerOrgId as unknown as never }
      : "skip",
  );
  const startCheckout = useMutation(api.billing.startCheckout);
  const [planTier, setPlanTier] = useState("growth");
  const [busy, setBusy] = useState(false);

  /* eslint-disable */
  useEffect(() => {
    if (!employerOrgId && employers && employers.length > 0) {
      setEmployerOrgId(employers[0]._id);
    }
  }, [employerOrgId, employers]);
  /* eslint-enable */

  if (employersRaw === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!employers || employers.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <EmptyState
          message="No employer organisations yet"
          description="Once an admin grants you Partner access or you complete Verified-tier onboarding, billing surfaces here."
        />
      </div>
    );
  }

  const onCheckout = async () => {
    if (!employerOrgId) return;
    setBusy(true);
    try {
      const { checkoutUrl } = await startCheckout({
        employerOrgId: employerOrgId as unknown as never,
        planTier,
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Plan, quota, and recent payment events. Card data never touches our
        servers — the processor handles checkout.
      </p>

      {employers.length > 1 && (
        <div className="mt-4">
          <Label htmlFor="org">Employer</Label>
          <select
            id="org"
            value={employerOrgId ?? ""}
            onChange={(e) => setEmployerOrgId(e.target.value)}
            className="mt-2 block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {employers.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="space-y-2 p-6 text-sm">
          {billing === undefined ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : billing === null ? (
            <p className="text-muted-foreground">No billing data.</p>
          ) : (
            <>
              <Row label="Organisation" value={billing.org.name} />
              <Row label="Plan tier" value={billing.org.planTier ?? "—"} />
              <Row
                label="Posts used"
                value={`${billing.org.jobPostsUsed}${
                  billing.org.jobPostQuota
                    ? ` / ${billing.org.jobPostQuota}`
                    : ""
                }`}
              />
              <Row
                label="Subscription status"
                value={billing.subscription?.status ?? "none"}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="space-y-3 p-6">
          <h2 className="text-sm font-medium">Change plan</h2>
          <select
            value={planTier}
            onChange={(e) => setPlanTier(e.target.value)}
            className="block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {PLAN_TIERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <Button onClick={onCheckout} disabled={busy || !employerOrgId}>
            {busy ? "Redirecting…" : "Continue to checkout"}
          </Button>
          <p className="text-xs text-muted-foreground">
            v1 returns a placeholder URL — live processor (Stripe / PayMongo /
            Maya) integrates in Phase 3.1.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-6">
          <h2 className="text-sm font-medium">Recent payment events</h2>
          {billing && billing.events && billing.events.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {(
                billing.events as Array<{
                  _id: string;
                  eventType: string;
                  receivedAt: number;
                }>
              ).map((e) => (
                <li key={e._id} className="flex justify-between">
                  <span>{e.eventType}</span>
                  <span>{new Date(e.receivedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No events yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
