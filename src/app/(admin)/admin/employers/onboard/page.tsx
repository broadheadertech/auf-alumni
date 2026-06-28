"use client";

/**
 * Employer onboarding actions (Epic 12) — relocated from the employers index
 * when that route became the rich roster. Grant Partner-tier directly, or
 * approve Verified-tier applicants. Backed by Convex; data appears once a
 * deployment is running.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/auf/EmptyState";

type Employer = {
  _id: string;
  name: string;
  slug: string;
  tier: string;
  websiteUrl?: string;
  hqCity?: string;
  planTier?: string;
  jobPostsUsed: number;
  suspendedAt?: number;
  createdAt: number;
};

export default function AdminEmployerOnboardPage() {
  const rows = useQuery(api.employerOrgs.listEmployers, {});
  const grantPartner = useMutation(api.employerOrgs.grantPartnerAccess);
  const approveVerified = useMutation(api.employerOrgs.approveVerifiedTier);
  const comp = useMutation(api.billing.compEmployer);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [hqCity, setHqCity] = useState("");
  const [busy, setBusy] = useState(false);

  const list = (rows ?? []) as Employer[];

  const onGrant = async () => {
    if (!name.trim() || !contactEmail.trim()) {
      toast.error("Name and contact email required");
      return;
    }
    setBusy(true);
    try {
      await grantPartner({
        name,
        contactEmail,
        websiteUrl: websiteUrl || undefined,
        hqCity: hqCity || undefined,
      });
      toast.success("Partner employer created");
      setName("");
      setContactEmail("");
      setWebsiteUrl("");
      setHqCity("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async (id: string) => {
    setBusy(true);
    try {
      await approveVerified({ employerOrgId: id as unknown as never });
      toast.success("Verified tier approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const onComp = async (id: string, tier: string) => {
    const reason = window.prompt("Reason for comping this employer?");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await comp({
        employerOrgId: id as unknown as never,
        tier,
        reason,
      });
      toast.success("Employer comped");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <Link
        href="/admin/employers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to roster
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Onboard employer
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Grant Partner-tier directly, or approve Verified-tier applicants.
      </p>

      <Card className="mt-6">
        <CardContent className="space-y-3 p-6">
          <h2 className="text-sm font-medium">Grant Partner access</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="emp-name">Organisation name</Label>
              <Input
                id="emp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="emp-contact">Contact email</Label>
              <Input
                id="emp-contact"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="emp-web">Website (optional)</Label>
              <Input
                id="emp-web"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="emp-city">HQ city (optional)</Label>
              <Input
                id="emp-city"
                value={hqCity}
                onChange={(e) => setHqCity(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={onGrant} disabled={busy}>
            Create Partner employer
          </Button>
        </CardContent>
      </Card>

      <h2 className="mt-8 text-sm font-medium text-muted-foreground">
        Live employer records (Convex)
      </h2>
      <div className="mt-3 space-y-2">
        {rows === undefined ? (
          <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-muted-foreground" />
        ) : list.length === 0 ? (
          <EmptyState
            message="No live employer records"
            description="Use the form above to onboard the first Partner, or review the demo roster."
          />
        ) : (
          list.map((e) => (
            <Card key={e._id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.tier} · {e.planTier ?? "—"} · {e.jobPostsUsed} posts
                    {e.suspendedAt ? " · suspended" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {e.tier === "unverified" && (
                    <Button
                      size="sm"
                      onClick={() => onApprove(e._id)}
                      disabled={busy}
                    >
                      Approve Verified
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onComp(e._id, "partner")}
                    disabled={busy}
                  >
                    Comp Partner
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
