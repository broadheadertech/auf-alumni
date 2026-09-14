"use client";

/**
 * Employer CMS — Company profile. The signed-in employer admin edits their
 * organisation's public page (/companies/[slug]): logo, tagline, about,
 * industry, size, founding year, website, headquarters, contact email.
 *
 * Company name and trust tier are read-only here — they're what AUF verified,
 * so changes go through an AUF admin. Backed by convex/employerOrgs.ts.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Building2, ExternalLink, ImagePlus, Lock, Save } from "lucide-react";
import { api } from "@/lib/convex-api";
import { useLookupOptions } from "@/lib/use-lookup-options";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Profile = {
  _id: string;
  name: string;
  slug: string;
  tier: string;
  tagline: string;
  about: string;
  industry: string;
  companySize: string;
  foundedYear: number | null;
  websiteUrl: string;
  hqCity: string;
  contactEmail: string;
  logoUrl: string | null;
  updatedAt: number;
  isPlatformAdmin: boolean;
  companySizes: string[];
};

type Form = {
  tagline: string;
  about: string;
  industry: string;
  companySize: string;
  foundedYear: string;
  websiteUrl: string;
  hqCity: string;
  contactEmail: string;
};

const TIER_LABEL: Record<string, string> = {
  partner: "Partner employer",
  verified: "Verified employer",
  unverified: "Pending verification",
};

function toForm(p: Profile): Form {
  return {
    tagline: p.tagline,
    about: p.about,
    industry: p.industry,
    companySize: p.companySize,
    foundedYear: p.foundedYear ? String(p.foundedYear) : "",
    websiteUrl: p.websiteUrl,
    hqCity: p.hqCity,
    contactEmail: p.contactEmail,
  };
}

export default function EmployerCompanyProfilePage() {
  const orgs = useQuery(api.employerOrgs.listMine) as
    | Array<{ _id: string; name: string }>
    | undefined;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const orgId = selectedId ?? orgs?.[0]?._id ?? null;

  const profile = useQuery(
    api.employerOrgs.getCompanyProfile,
    orgId ? { employerOrgId: orgId as never } : "skip",
  ) as Profile | undefined;

  if (orgs === undefined || (orgId && profile === undefined)) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 text-sm text-muted-foreground">
        Loading company profile…
      </div>
    );
  }

  if (!orgId || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <Card>
          <CardContent className="p-10 text-center">
            <h1 className="text-lg font-semibold">No employer organisation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account isn&apos;t linked to an employer yet. Ask an AUF admin
              to grant your organisation access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      {orgs.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <Label htmlFor="org-picker" className="text-xs text-muted-foreground">
            Organisation
          </Label>
          <select
            id="org-picker"
            value={orgId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {orgs.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {/* Key by org so switching orgs rehydrates the form. */}
      <CompanyProfileForm key={profile._id} profile={profile} />
    </div>
  );
}

function CompanyProfileForm({ profile }: { profile: Profile }) {
  const update = useMutation(api.employerOrgs.updateCompanyProfile);
  const uploadUrl = useMutation(api.employerOrgs.generateLogoUploadUrl);
  const setLogo = useMutation(api.employerOrgs.setCompanyLogo);
  const areas = useLookupOptions("area");

  const [form, setForm] = useState<Form>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // After a save, adopt the server's normalised values (e.g. https:// prefix).
  const serverForm = toForm(profile);
  const serverKey = JSON.stringify(serverForm);
  const [lastServerKey, setLastServerKey] = useState(serverKey);
  /* eslint-disable */
  useEffect(() => {
    if (serverKey !== lastServerKey) {
      setLastServerKey(serverKey);
      setForm(serverForm);
    }
  }, [serverKey]);
  /* eslint-enable */

  const dirty = (Object.keys(form) as Array<keyof Form>).some(
    (k) => form[k] !== serverForm[k],
  );
  const set = (k: keyof Form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const year = form.foundedYear.trim();
    if (year && !/^\d{4}$/.test(year)) {
      toast.error("Founded year must be a 4-digit year");
      return;
    }
    setSaving(true);
    try {
      await update({
        employerOrgId: profile._id as never,
        tagline: form.tagline,
        about: form.about,
        industry: form.industry,
        companySize: form.companySize,
        foundedYear: year ? Number(year) : undefined,
        websiteUrl: form.websiteUrl,
        hqCity: form.hqCity,
        contactEmail: form.contactEmail,
      });
      toast.success("Company profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadUrl({ employerOrgId: profile._id as never });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      await setLogo({ employerOrgId: profile._id as never, storageId: storageId as never });
      toast.success("Logo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <form onSubmit={onSave}>
      <div className="flex flex-wrap items-center gap-2">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Company profile</h1>
        <Link
          href={`/companies/${profile.slug}`}
          target="_blank"
          className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          View public page <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        This is what AUF alumni see on your company page and next to your job
        posts.
      </p>

      {/* Identity */}
      <Card className="mt-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-xl font-semibold">
            {profile.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logoUrl} alt={`${profile.name} logo`} className="h-full w-full object-contain" />
            ) : (
              profile.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{profile.name}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {TIER_LABEL[profile.tier] ?? profile.tier}
              </span>
            </div>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              {profile.isPlatformAdmin
                ? "Name and tier are managed from Admin → Employers."
                : "Name and verification tier are managed by AUF. Contact Alumni Relations to change them."}
            </p>
          </div>
          <div className="flex gap-2">
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Uploading…" : profile.logoUrl ? "Replace logo" : "Upload logo"}
              <input type="file" accept="image/*" className="sr-only" onChange={onLogoChange} />
            </label>
            {profile.logoUrl && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setLogo({ employerOrgId: profile._id as never, storageId: undefined }).then(
                    () => toast.success("Logo removed"),
                    (err: unknown) =>
                      toast.error(err instanceof Error ? err.message : "Could not remove"),
                  )
                }
              >
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="mt-4">
        <CardContent className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">About the company</h2>
          <div>
            <Label htmlFor="c-tagline">Tagline</Label>
            <Input
              id="c-tagline"
              value={form.tagline}
              onChange={set("tagline")}
              maxLength={120}
              placeholder="One line on what you do"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="c-about">About</Label>
            <Textarea
              id="c-about"
              rows={7}
              value={form.about}
              onChange={set("about")}
              maxLength={3000}
              placeholder="Mission, products, culture, and why AUF graduates thrive here."
              className="mt-1.5"
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
              {form.about.length}/3000
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="c-industry">Industry</Label>
              <Input
                id="c-industry"
                value={form.industry}
                onChange={set("industry")}
                maxLength={80}
                placeholder="e.g. Healthcare"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="c-size">Company size</Label>
              <select
                id="c-size"
                value={form.companySize}
                onChange={set("companySize")}
                className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">Not specified</option>
                {profile.companySizes.map((s) => (
                  <option key={s} value={s}>
                    {s} employees
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="c-founded">Founded</Label>
              <Input
                id="c-founded"
                inputMode="numeric"
                value={form.foundedYear}
                onChange={set("foundedYear")}
                maxLength={4}
                placeholder="e.g. 1995"
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="mt-4">
        <CardContent className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Location &amp; contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-hq">Headquarters</Label>
              <Input
                id="c-hq"
                value={form.hqCity}
                onChange={set("hqCity")}
                maxLength={120}
                list="area-options"
                placeholder="e.g. Clark Freeport Zone"
                className="mt-1.5"
              />
              <datalist id="area-options">
                {areas.names.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="c-website">Website</Label>
              <Input
                id="c-website"
                value={form.websiteUrl}
                onChange={set("websiteUrl")}
                maxLength={200}
                placeholder="https://"
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="c-email">Recruitment contact email</Label>
              <Input
                id="c-email"
                type="email"
                value={form.contactEmail}
                onChange={set("contactEmail")}
                maxLength={200}
                placeholder="careers@company.com"
                className="mt-1.5"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Shown to AUF admins only — not on the public page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-end gap-2">
        {dirty && (
          <Button type="button" variant="outline" onClick={() => setForm(serverForm)} disabled={saving}>
            Discard
          </Button>
        )}
        <Button type="submit" disabled={saving || !dirty}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>
    </form>
  );
}
