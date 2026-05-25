"use client";

/**
 * Admin employer roster (Epic 12).
 *
 * Lists all employer orgs with tier, plan, post usage, and approval/comp
 * controls. Granting Partner via this surface fires the audit-logged
 * mutation. Verified-tier applications appear here too — admin clicks
 * Approve to flip them from unverified → verified.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

export default function AdminEmployersPage() {
  const rows = useQuery(api.employerOrgs.listEmployers, {});
  const grantPartner = useMutation(api.employerOrgs.grantPartnerAccess);
  const approveVerified = useMutation(api.employerOrgs.approveVerifiedTier);
  const comp = useMutation(api.billing.compEmployer);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [hqCity, setHqCity] = useState("");
  const [busy, setBusy] = useState(false);

  if (rows === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Employers</h1>
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

      <div className="mt-6 space-y-2">
        {list.length === 0 ? (
          <EmptyState
            message="No employers yet"
            description="Use the form above to onboard the first Partner."
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
