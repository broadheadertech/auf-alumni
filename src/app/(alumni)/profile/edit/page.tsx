"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  Plus,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import {
  DEGREES,
  OPEN_TO_KINDS,
  PROGRAMS,
  type OpenToKind,
  type PrivacyTier,
} from "@/lib/schemas/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MONTH_OPTIONS,
  formatPeriod,
  periodError,
  yearOptions,
  type ExperienceDraft,
} from "@/lib/experience";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProgramOptions } from "@/lib/use-program-options";
import { useLookupOptions } from "@/lib/use-lookup-options";
import {
  PrivacyTierIcon,
  type PrivacyTier as PrivacyTierType,
} from "@/components/auf/PrivacyTierIcon";
import { OpenToTag } from "@/components/auf/OpenToTag";
import {
  ProfilePreviewSwitcher,
  type PreviewViewer,
} from "@/components/auf/ProfilePreviewSwitcher";
import { prepareImageForUpload } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();
const BATCH_OPTIONS: number[] = [];
for (let y = CURRENT_YEAR; y >= 1960; y--) BATCH_OPTIONS.push(y);

const TIER_RANK: Record<PrivacyTier, number> = {
  public: 0,
  alumni: 1,
  connections: 2,
  private: 3,
};
const VIEWER_RANK: Record<PreviewViewer, number> = {
  stranger: 0,
  alumnus: 1,
  connection: 2,
  self: 3,
};

type FormState = {
  displayName: string;
  batch: number;
  program: string;
  degree: string;
  currentRole: string;
  company: string;
  city: string;
  country: string;
  employmentStatus: string;
  bio: string;
  skills: string[];
  openTo: OpenToKind[];
  openToWork: boolean;
  openToWorkNote: string;
  phone: string;
  addressLine: string;
  links: Record<LinkKey, string>;
  experience: ExperienceDraft[];
  education: {
    degree: string;
    program: string;
    school: string;
    year: number;
  }[];
  privacyTiers: Record<string, PrivacyTier>;
  excludeFromSearchEngines: boolean;
};

type LinkKey = "linkedin" | "facebook" | "instagram" | "github" | "website";

/** The social fields, in the order they appear in the Contact section. */
const LINK_FIELDS: { key: LinkKey; label: string; placeholder: string }[] = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/your-name" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/your-name" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/your-name" },
  { key: "github", label: "GitHub", placeholder: "github.com/your-name" },
  { key: "website", label: "Website", placeholder: "your-site.com" },
];

const EMPTY_LINKS: Record<LinkKey, string> = {
  linkedin: "",
  facebook: "",
  instagram: "",
  github: "",
  website: "",
};

const DEFAULT_TIERS: Record<string, PrivacyTier> = {
  currentRole: "alumni",
  company: "alumni",
  city: "alumni",
  country: "public",
  employmentStatus: "alumni",
  // Contact details start closed. A phone number is for people you have
  // actually connected with, and a home address is nobody's business by
  // default — both can be opened up deliberately, but never by omission.
  phone: "connections",
  addressLine: "private",
  links: "alumni",
  bio: "alumni",
  skills: "alumni",
  experience: "alumni",
  education: "alumni",
};

/** Sentinel for an unset month/year (Select items need a non-empty value). */
const NONE = "__none";
const YEAR_CHOICES = yearOptions();

/** Select sentinel for "no employment status" (Select items need a value). */
const NO_STATUS = "__none__";

const SECTIONS: { id: string; label: string }[] = [
  { id: "opentowork", label: "Open to work" },
  { id: "photo", label: "Photo" },
  { id: "identity", label: "Identity" },
  { id: "work", label: "Work" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
  { id: "opento", label: "Open to" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "privacy", label: "Privacy" },
];

const EMPTY: FormState = {
  displayName: "",
  batch: CURRENT_YEAR,
  program: PROGRAMS[0],
  degree: DEGREES[0],
  currentRole: "",
  company: "",
  city: "",
  country: "",
  employmentStatus: "",
  bio: "",
  skills: [],
  openTo: [],
  openToWork: false,
  openToWorkNote: "",
  phone: "",
  addressLine: "",
  links: EMPTY_LINKS,
  experience: [],
  education: [],
  privacyTiers: DEFAULT_TIERS,
  excludeFromSearchEngines: false,
};

export default function ProfileEditPage() {
  const existing = useQuery(api.profiles.getMyProfile);
  const photoUrl = useQuery(
    api.profiles.getPhotoUrl,
    existing?.photoStorageId
      ? { storageId: existing.photoStorageId }
      : { storageId: undefined },
  );
  const saveProfile = useMutation(api.profiles.createOrUpdateMyProfile);
  const uploadUrl = useMutation(api.profiles.generatePhotoUploadUrl);
  const setPhoto = useMutation(api.profiles.setPhoto);
  const programOptions = useProgramOptions();
  const areaOptions = useLookupOptions("area");
  const statusOptions = useLookupOptions("status");
  const skillOptions = useLookupOptions("skill");

  const [state, setState] = useState<FormState>(EMPTY);
  const [skillInput, setSkillInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewerPreview, setViewerPreview] = useState<PreviewViewer>("self");
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("photo");

  // Hydrate the form from the existing profile exactly once per profile-id.
  // Guard with `hydratedId` so re-renders from the query subscription don't
  // clobber in-progress edits. The setState-in-effect is intentional and
  // gated; eslint can't see the gate, so we suppress here.
  /* eslint-disable */
  useEffect(() => {
    if (!existing) return;
    const existingId = existing._id ?? null;
    if (hydratedId === existingId) return;
    setHydratedId(existingId);
    setState({
      displayName: existing.displayName ?? "",
      batch: existing.batch ?? CURRENT_YEAR,
      program: existing.program ?? PROGRAMS[0],
      degree: existing.degree ?? DEGREES[0],
      currentRole: existing.currentRole ?? "",
      company: existing.company ?? "",
      city: existing.city ?? "",
      country: existing.country ?? "",
      employmentStatus: existing.employmentStatus ?? "",
      bio: existing.bio ?? "",
      skills: existing.skills ?? [],
      openTo: (existing.openTo ?? []) as OpenToKind[],
      openToWork: existing.openToWork ?? false,
      openToWorkNote: existing.openToWorkNote ?? "",
      phone: (existing.phone as string | undefined) ?? "",
      addressLine: (existing.addressLine as string | undefined) ?? "",
      links: {
        ...EMPTY_LINKS,
        ...((existing.links as Record<LinkKey, string> | undefined) ?? {}),
      },
      experience: existing.experience ?? [],
      education: existing.education ?? [],
      privacyTiers: {
        ...DEFAULT_TIERS,
        ...(existing.privacyTiers as Record<string, "connections" | "public" | "alumni" | "private"> ?? {}),
      },
      excludeFromSearchEngines: existing.excludeFromSearchEngines ?? false,
    });
  }, [existing, hydratedId]);
  /* eslint-enable */

  const isPreviewMode = viewerPreview !== "self";
  const previewRank = VIEWER_RANK[viewerPreview];

  const fieldVisibleInPreview = (fieldKey: string): boolean => {
    if (!isPreviewMode) return true;
    const tier = (state.privacyTiers[fieldKey] ?? "alumni") as PrivacyTier;
    return previewRank >= TIER_RANK[tier];
  };

  const updateTier = (field: string, tier: PrivacyTierType) => {
    setState((s) => ({
      ...s,
      privacyTiers: { ...s.privacyTiers, [field]: tier as PrivacyTier },
    }));
  };

  const toggleOpenTo = (kind: OpenToKind) => {
    setState((s) => ({
      ...s,
      openTo: s.openTo.includes(kind)
        ? s.openTo.filter((k) => k !== kind)
        : [...s.openTo, kind],
    }));
  };

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v || state.skills.includes(v) || state.skills.length >= 30) {
      setSkillInput("");
      return;
    }
    setState((s) => ({ ...s, skills: [...s.skills, v] }));
    setSkillInput("");
  };

  const removeSkill = (skill: string) =>
    setState((s) => ({ ...s, skills: s.skills.filter((x) => x !== skill) }));

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Downscale and re-encode rather than refusing phone photos outright —
      // see src/lib/image-upload.ts.
      const { blob, contentType } = await prepareImageForUpload(file);
      const url = await uploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: blob,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      await setPhoto({ storageId: storageId as unknown as never });
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = async () => {
    try {
      await setPhoto({ storageId: undefined });
      toast.success("Photo removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.displayName.trim().length === 0) {
      toast.error("Display name is required");
      return;
    }
    setSubmitting(true);
    try {
      await saveProfile({
        displayName: state.displayName.trim(),
        batch: state.batch,
        program: state.program,
        degree: state.degree,
        currentRole: state.currentRole.trim() || undefined,
        company: state.company.trim() || undefined,
        city: state.city.trim() || undefined,
        country: state.country.trim() || undefined,
        employmentStatus: state.employmentStatus || undefined,
        bio: state.bio.trim() || undefined,
        skills: state.skills,
        openTo: state.openTo,
        openToWork: state.openToWork,
        openToWorkNote: state.openToWork
          ? state.openToWorkNote.trim() || undefined
          : undefined,
        phone: state.phone.trim() || undefined,
        addressLine: state.addressLine.trim() || undefined,
        links: Object.fromEntries(
          LINK_FIELDS.map((f) => [f.key, state.links[f.key].trim()]).filter(
            ([, v]) => v,
          ),
        ),
        experience: state.experience,
        education: state.education,
        privacyTiers: state.privacyTiers,
        excludeFromSearchEngines: state.excludeFromSearchEngines,
      });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const showHiddenInPreview = useMemo(
    () => (key: string) => {
      if (!isPreviewMode) return false;
      return !fieldVisibleInPreview(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPreviewMode, viewerPreview, state.privacyTiers],
  );

  const initials =
    state.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?";

  const completeness = useMemo(() => {
    const checks = [
      { anchor: "photo", label: "Add a profile photo", done: !!photoUrl },
      { anchor: "work", label: "Add your current role", done: !!state.currentRole.trim() },
      { anchor: "work", label: "Add your company", done: !!state.company.trim() },
      { anchor: "work", label: "Add your location", done: !!(state.city.trim() || state.country.trim()) },
      { anchor: "about", label: "Write your summary", done: state.bio.trim().length >= 40 },
      { anchor: "skills", label: "Add 3+ skills", done: state.skills.length >= 3 },
      { anchor: "experience", label: "Add work experience", done: state.experience.length > 0 },
      { anchor: "education", label: "Add education", done: state.education.length > 0 },
      { anchor: "opento", label: "Set what you're open to", done: state.openTo.length > 0 },
    ];
    const done = checks.filter((c) => c.done).length;
    return {
      checks,
      done,
      total: checks.length,
      pct: Math.round((done / checks.length) * 100),
    };
  }, [photoUrl, state]);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Privacy is set per-field. Preview how others see you with the toggle.
          </p>
        </div>
        <ProfilePreviewSwitcher
          value={viewerPreview}
          onChange={setViewerPreview}
        />
      </div>

      {/* Hero — cover, avatar w/ completeness ring, identity below */}
      <Card className="overflow-hidden p-0">
        <div
          className="h-24 sm:h-28"
          style={{
            background:
              "linear-gradient(120deg, var(--brand-deep) 0%, var(--brand) 100%)",
          }}
        />
        <CardContent className="px-6 pb-5">
          <div className="-mt-12 flex items-start justify-between gap-4">
            <CompletenessRing pct={completeness.pct} size={104} stroke={4}>
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold text-foreground ring-4 ring-card">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
            </CompletenessRing>
            <span className="mt-14 hidden shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 sm:inline-flex dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Alumna
            </span>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-[22px] font-semibold leading-tight">
                {state.displayName || "Your name"}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 sm:hidden dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> Verified
              </span>
              {state.openToWork && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                  Open to work
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[15px] text-foreground/90">
              {[state.currentRole, state.company].filter(Boolean).join(" · ") ||
                "Add your current role"}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {state.program} · Class of {state.batch}
              {state.city || state.country
                ? " · " + [state.city, state.country].filter(Boolean).join(", ")
                : ""}
            </p>
            {state.openTo.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {state.openTo.map((k) => (
                  <OpenToTag key={k} kind={k} variant="subtle" />
                ))}
              </div>
            )}
          </div>

          {/* Strength summary line */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs">
            <span className="font-medium">Profile strength</span>
            <span className="font-semibold tabular-nums">{completeness.pct}%</span>
            {completeness.done < completeness.total ? (
              <>
                <span className="text-muted-foreground">
                  · {completeness.total - completeness.done} to finish:
                </span>
                {completeness.checks
                  .filter((c) => !c.done)
                  .slice(0, 4)
                  .map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setActiveTab(c.anchor)}
                      className="brand-fg underline-offset-2 hover:underline"
                    >
                      {c.label}
                    </button>
                  ))}
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> All set — nice profile.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section tabs — switch panels instead of scrolling */}
      <div
        data-tour="profile-sections"
        className="my-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1"
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveTab(s.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === s.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isPreviewMode && (
        <Card className="mb-6 border-[var(--color-accent)]/30 bg-[oklch(0.55_0.20_25_/_0.05)]">
          <CardContent className="p-4 text-sm">
            <strong>Preview mode</strong> — viewing as a{" "}
            {viewerPreview === "stranger"
              ? "stranger (no account)"
              : viewerPreview === "alumnus"
                ? "verified alumna not connected to you"
                : "verified alumna connected to you"}
            . Editing disabled. Hidden fields show as “Hidden from this viewer”.
          </CardContent>
        </Card>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset disabled={isPreviewMode} className="space-y-6">
          {/* Open to work banner */}
          <Card
            id="opentowork"
            className={cn(
              state.openToWork && "ring-emerald-500/40",
              activeTab !== "opentowork" && "hidden",
            )}
          >
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Open to work</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Turn this on to signal you&apos;re looking. Shows an
                    &ldquo;Open to work&rdquo; banner on your profile and
                    surfaces you to recruiters and in the directory.
                  </p>
                </div>
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={state.openToWork}
                    onChange={(e) =>
                      setState((s) => ({ ...s, openToWork: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm font-medium">
                    {state.openToWork ? "On" : "Off"}
                  </span>
                </label>
              </div>
              {state.openToWork && (
                <div className="mt-4">
                  <Label htmlFor="otwNote">
                    What you&apos;re looking for (optional)
                  </Label>
                  <Input
                    id="otwNote"
                    value={state.openToWorkNote}
                    maxLength={140}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        openToWorkNote: e.target.value,
                      }))
                    }
                    placeholder="e.g. Frontend / product roles · remote-friendly · PH or SG"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photo */}
          <Card id="photo" className={cn(activeTab !== "photo" && "hidden")}>
            <CardContent className="p-6">
              <h2 className="font-semibold">Photo</h2>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-semibold">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (state.displayName.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?")
                  )}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <label
                    htmlFor="photo-input"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {photoUrl ? "Replace" : "Upload"}
                  </label>
                  <input
                    id="photo-input"
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="sr-only"
                    onChange={onPhotoChange}
                    disabled={uploading}
                  />
                  {photoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removePhoto}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Identity */}
          <Card id="identity" className={cn(activeTab !== "identity" && "hidden")}>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">Identity</h2>
              <div>
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={state.displayName}
                  onChange={(e) =>
                    setState((s) => ({ ...s, displayName: e.target.value }))
                  }
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  How your name appears across the app. Always visible — name is
                  identity, not a private field.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="batch">Batch</Label>
                  <Select
                    value={String(state.batch)}
                    onValueChange={(v) =>
                      setState((s) => ({
                        ...s,
                        batch: Number(v ?? CURRENT_YEAR),
                      }))
                    }
                  >
                    <SelectTrigger id="batch">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BATCH_OPTIONS.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="program">Program</Label>
                  <Select
                    value={state.program}
                    onValueChange={(v) =>
                      setState((s) => ({ ...s, program: v ?? s.program }))
                    }
                  >
                    <SelectTrigger id="program">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {state.program &&
                        !programOptions.all.includes(state.program) && (
                          <SelectGroup>
                            <SelectLabel>Current</SelectLabel>
                            <SelectItem value={state.program}>
                              {state.program}
                            </SelectItem>
                          </SelectGroup>
                        )}
                      {programOptions.groups.map((g) => (
                        <SelectGroup key={g.college}>
                          <SelectLabel>{g.college}</SelectLabel>
                          {g.programs.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="degree">Degree</Label>
                  <Select
                    value={state.degree}
                    onValueChange={(v) =>
                      setState((s) => ({ ...s, degree: v ?? DEGREES[0] }))
                    }
                  >
                    <SelectTrigger id="degree">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEGREES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work + location */}
          <Card id="work" className={cn(activeTab !== "work" && "hidden")}>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">Where you are now</h2>
              <FieldWithPrivacy
                label="Employment status"
                fieldKey="employmentStatus"
                tier={state.privacyTiers.employmentStatus ?? "alumni"}
                onTier={(t) => updateTier("employmentStatus", t)}
                hidden={showHiddenInPreview("employmentStatus")}
              >
                <Select
                  value={state.employmentStatus || NO_STATUS}
                  onValueChange={(v) =>
                    setState((s) => ({
                      ...s,
                      employmentStatus: !v || v === NO_STATUS ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Employment status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_STATUS}>Not specified</SelectItem>
                    {state.employmentStatus &&
                      !statusOptions.names.includes(state.employmentStatus) && (
                        <SelectItem value={state.employmentStatus}>
                          {state.employmentStatus}
                        </SelectItem>
                      )}
                    {statusOptions.options.map((o) => (
                      <SelectItem key={o._id} value={o.name}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldWithPrivacy>
              <FieldWithPrivacy
                label="Current role"
                fieldKey="currentRole"
                tier={state.privacyTiers.currentRole ?? "alumni"}
                onTier={(t) => updateTier("currentRole", t)}
                hidden={showHiddenInPreview("currentRole")}
              >
                <Input
                  value={state.currentRole}
                  onChange={(e) =>
                    setState((s) => ({ ...s, currentRole: e.target.value }))
                  }
                />
              </FieldWithPrivacy>
              <FieldWithPrivacy
                label="Company"
                fieldKey="company"
                tier={state.privacyTiers.company ?? "alumni"}
                onTier={(t) => updateTier("company", t)}
                hidden={showHiddenInPreview("company")}
              >
                <Input
                  value={state.company}
                  onChange={(e) =>
                    setState((s) => ({ ...s, company: e.target.value }))
                  }
                />
              </FieldWithPrivacy>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWithPrivacy
                  label="City"
                  fieldKey="city"
                  tier={state.privacyTiers.city ?? "alumni"}
                  onTier={(t) => updateTier("city", t)}
                  hidden={showHiddenInPreview("city")}
                >
                  <Input
                    value={state.city}
                    list="area-options"
                    onChange={(e) =>
                      setState((s) => ({ ...s, city: e.target.value }))
                    }
                  />
                  <datalist id="area-options">
                    {areaOptions.names.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </FieldWithPrivacy>
                <FieldWithPrivacy
                  label="Country"
                  fieldKey="country"
                  tier={state.privacyTiers.country ?? "public"}
                  onTier={(t) => updateTier("country", t)}
                  hidden={showHiddenInPreview("country")}
                >
                  <Input
                    value={state.country}
                    onChange={(e) =>
                      setState((s) => ({ ...s, country: e.target.value }))
                    }
                  />
                </FieldWithPrivacy>
              </div>
            </CardContent>
          </Card>

          {/* Bio */}
          <Card id="about" className={cn(activeTab !== "about" && "hidden")}>
            <CardContent className="space-y-2 p-6">
              <FieldWithPrivacy
                label="About"
                fieldKey="bio"
                tier={state.privacyTiers.bio ?? "alumni"}
                onTier={(t) => updateTier("bio", t)}
                hidden={showHiddenInPreview("bio")}
              >
                <Textarea
                  rows={4}
                  maxLength={2000}
                  value={state.bio}
                  onChange={(e) =>
                    setState((s) => ({ ...s, bio: e.target.value }))
                  }
                  placeholder="What would you tell a junior in your field?"
                />
              </FieldWithPrivacy>
            </CardContent>
          </Card>

          {/* Open to */}
          <Card id="opento" className={cn(activeTab !== "opento" && "hidden")}>
            <CardContent className="space-y-3 p-6">
              <h2 className="font-semibold">Open to</h2>
              <p className="text-xs text-muted-foreground">
                Toggle the kinds of conversations you welcome. Visible across
                directory and profile surfaces.
              </p>
              <div className="flex flex-wrap gap-2">
                {OPEN_TO_KINDS.map((kind) => {
                  const active = state.openTo.includes(kind);
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => toggleOpenTo(kind)}
                      className={cn(
                        "rounded-full transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        !active && "opacity-50 hover:opacity-100",
                      )}
                      aria-pressed={active}
                    >
                      <OpenToTag kind={kind} variant={active ? "subtle" : "outline"} />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card id="skills" className={cn(activeTab !== "skills" && "hidden")}>
            <CardContent className="space-y-2 p-6">
              <FieldWithPrivacy
                label="Skills"
                fieldKey="skills"
                tier={state.privacyTiers.skills ?? "alumni"}
                onTier={(t) => updateTier("skills", t)}
                hidden={showHiddenInPreview("skills")}
              >
                <div className="flex flex-wrap gap-2">
                  {state.skills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSkill(s)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${s}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="Add a skill (press Enter)"
                    list="skill-options"
                  />
                  <datalist id="skill-options">
                    {skillOptions.names
                      .filter((n) => !state.skills.includes(n))
                      .map((n) => (
                        <option key={n} value={n} />
                      ))}
                  </datalist>
                  <Button type="button" size="sm" variant="outline" onClick={addSkill}>
                    Add
                  </Button>
                </div>
              </FieldWithPrivacy>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card id="contact" className={cn(activeTab !== "contact" && "hidden")}>
            <CardContent className="space-y-4 p-6">
              <FieldWithPrivacy
                label="Phone"
                fieldKey="phone"
                tier={state.privacyTiers.phone ?? "connections"}
                onTier={(t) => updateTier("phone", t)}
                hidden={showHiddenInPreview("phone")}
              >
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+63 917 555 0101"
                  value={state.phone}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </FieldWithPrivacy>

              <FieldWithPrivacy
                label="Address"
                fieldKey="addressLine"
                tier={state.privacyTiers.addressLine ?? "private"}
                onTier={(t) => updateTier("addressLine", t)}
                hidden={showHiddenInPreview("addressLine")}
              >
                <Input
                  id="addressLine"
                  placeholder="House / street / barangay"
                  value={state.addressLine}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      addressLine: e.target.value,
                    }))
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Used for posting your Alumni ID and printed invitations. It
                  starts visible only to you — open it up only if you want to.
                  Your city and country are set under Identity.
                </p>
              </FieldWithPrivacy>

              <FieldWithPrivacy
                label="Social links"
                fieldKey="links"
                tier={state.privacyTiers.links ?? "alumni"}
                onTier={(t) => updateTier("links", t)}
                hidden={showHiddenInPreview("links")}
              >
                <div className="space-y-2">
                  {LINK_FIELDS.map((f) => (
                    <div key={f.key} className="grid gap-1 sm:grid-cols-[110px_1fr] sm:items-center">
                      <Label
                        htmlFor={`link-${f.key}`}
                        className="text-xs text-muted-foreground"
                      >
                        {f.label}
                      </Label>
                      <Input
                        id={`link-${f.key}`}
                        inputMode="url"
                        placeholder={f.placeholder}
                        value={state.links[f.key]}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            links: { ...prev.links, [f.key]: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Paste the address or just the handle part — https:// is
                    added for you. Anything that is not a web address is
                    dropped when you save.
                  </p>
                </div>
              </FieldWithPrivacy>
            </CardContent>
          </Card>

          <Card id="experience" className={cn(activeTab !== "experience" && "hidden")}>
            <CardContent className="space-y-3 p-6">
              <FieldWithPrivacy
                label="Experience"
                fieldKey="experience"
                tier={state.privacyTiers.experience ?? "alumni"}
                onTier={(t) => updateTier("experience", t)}
                hidden={showHiddenInPreview("experience")}
              >
                <div className="space-y-3">
                  {state.experience.map((entry, idx) => {
                    const patch = (fields: Partial<ExperienceDraft>) =>
                      setState((prev) => {
                        const next = [...prev.experience];
                        next[idx] = { ...next[idx], ...fields };
                        next[idx].years = formatPeriod(next[idx]);
                        return { ...prev, experience: next };
                      });
                    const err = periodError(entry);
                    const monthItems = (
                      <>
                        <SelectItem value={NONE}>Month</SelectItem>
                        {MONTH_OPTIONS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </>
                    );
                    const yearItems = (
                      <>
                        <SelectItem value={NONE}>Year</SelectItem>
                        {YEAR_CHOICES.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </>
                    );
                    return (
                      <div
                        key={idx}
                        className="rounded-md border border-border p-3"
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder="Role"
                            value={entry.role}
                            onChange={(e) => patch({ role: e.target.value })}
                          />
                          <Input
                            placeholder="Company"
                            value={entry.company}
                            onChange={(e) => patch({ company: e.target.value })}
                          />
                        </div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              From
                            </Label>
                            <div className="mt-1 flex gap-2">
                              <Select
                                value={
                                  entry.startMonth
                                    ? String(entry.startMonth)
                                    : NONE
                                }
                                onValueChange={(v) =>
                                  patch({
                                    startMonth:
                                      !v || v === NONE ? undefined : Number(v),
                                  })
                                }
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>{monthItems}</SelectContent>
                              </Select>
                              <Select
                                value={
                                  entry.startYear
                                    ? String(entry.startYear)
                                    : NONE
                                }
                                onValueChange={(v) =>
                                  patch({
                                    startYear:
                                      !v || v === NONE ? undefined : Number(v),
                                  })
                                }
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>{yearItems}</SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground">
                              To
                            </Label>
                            <div className="mt-1 flex gap-2">
                              <Select
                                disabled={entry.current === true}
                                value={
                                  entry.endMonth ? String(entry.endMonth) : NONE
                                }
                                onValueChange={(v) =>
                                  patch({
                                    endMonth:
                                      !v || v === NONE ? undefined : Number(v),
                                  })
                                }
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>{monthItems}</SelectContent>
                              </Select>
                              <Select
                                disabled={entry.current === true}
                                value={
                                  entry.endYear ? String(entry.endYear) : NONE
                                }
                                onValueChange={(v) =>
                                  patch({
                                    endYear:
                                      !v || v === NONE ? undefined : Number(v),
                                  })
                                }
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue
                                    placeholder={
                                      entry.current ? "Present" : "Year"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>{yearItems}</SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <label className="mt-2 flex w-fit items-center gap-2 text-sm">
                          <Checkbox
                            checked={entry.current === true}
                            onCheckedChange={(v) =>
                              patch(
                                v === true
                                  ? {
                                      current: true,
                                      endYear: undefined,
                                      endMonth: undefined,
                                    }
                                  : { current: false },
                              )
                            }
                          />
                          I currently work here
                        </label>

                        {err ? (
                          <p className="mt-2 text-xs text-destructive">{err}</p>
                        ) : entry.years ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Shows as: {entry.years}
                          </p>
                        ) : null}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-muted-foreground"
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              experience: prev.experience.filter(
                                (_, i) => i !== idx,
                              ),
                            }))
                          }
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        experience: [
                          ...prev.experience,
                          { role: "", company: "", years: "" },
                        ],
                      }))
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add experience
                  </Button>
                </div>
              </FieldWithPrivacy>
            </CardContent>
          </Card>

          {/* Education */}
          <Card id="education" className={cn(activeTab !== "education" && "hidden")}>
            <CardContent className="space-y-3 p-6">
              <FieldWithPrivacy
                label="Education"
                fieldKey="education"
                tier={state.privacyTiers.education ?? "alumni"}
                onTier={(t) => updateTier("education", t)}
                hidden={showHiddenInPreview("education")}
              >
                <div className="space-y-3">
                  {state.education.map((entry, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-border p-3"
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Degree"
                          value={entry.degree}
                          onChange={(e) => {
                            const next = [...state.education];
                            next[idx] = { ...entry, degree: e.target.value };
                            setState((s) => ({ ...s, education: next }));
                          }}
                        />
                        <Input
                          placeholder="Program"
                          value={entry.program}
                          onChange={(e) => {
                            const next = [...state.education];
                            next[idx] = { ...entry, program: e.target.value };
                            setState((s) => ({ ...s, education: next }));
                          }}
                        />
                        <Input
                          placeholder="School"
                          value={entry.school}
                          onChange={(e) => {
                            const next = [...state.education];
                            next[idx] = { ...entry, school: e.target.value };
                            setState((s) => ({ ...s, education: next }));
                          }}
                        />
                        <Input
                          type="number"
                          placeholder="Year"
                          value={entry.year}
                          onChange={(e) => {
                            const next = [...state.education];
                            next[idx] = {
                              ...entry,
                              year: Number(e.target.value),
                            };
                            setState((s) => ({ ...s, education: next }));
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-muted-foreground"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            education: s.education.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        education: [
                          ...s.education,
                          {
                            degree: "",
                            program: "",
                            school: "Angeles University Foundation",
                            year: CURRENT_YEAR,
                          },
                        ],
                      }))
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add education
                  </Button>
                </div>
              </FieldWithPrivacy>
            </CardContent>
          </Card>

          {/* SEO opt-out */}
          <Card id="privacy" className={cn(activeTab !== "privacy" && "hidden")}>
            <CardContent className="flex items-start justify-between gap-3 p-6">
              <div>
                <h2 className="font-semibold">Search engines</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Exclude my public-tier fields from search-engine indexing.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.excludeFromSearchEngines}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      excludeFromSearchEngines: e.target.checked,
                    }))
                  }
                />
                <span className="text-sm">Exclude</span>
              </label>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button data-tour="profile-save" type="submit" size="lg" disabled={submitting}>
              {submitting ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

function CompletenessRing({
  pct,
  size,
  stroke,
  children,
}: {
  pct: number;
  size: number;
  stroke: number;
  children: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference * (1 - clamped / 100);
  const color = clamped >= 80 ? "#10b981" : clamped >= 50 ? "#0ea5e9" : "#f59e0b";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all"
        />
      </svg>
      <div className="absolute" style={{ inset: stroke + 3 }}>
        {children}
      </div>
    </div>
  );
}

function FieldWithPrivacy({
  label,
  fieldKey,
  tier,
  onTier,
  hidden,
  children,
}: {
  label: string;
  fieldKey: string;
  tier: string;
  onTier: (t: PrivacyTierType) => void;
  hidden: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Label htmlFor={fieldKey}>{label}</Label>
        <PrivacyTierIcon
          tier={tier as PrivacyTierType}
          editable
          onChange={onTier}
        />
      </div>
      {hidden ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Hidden from this viewer.
        </div>
      ) : (
        children
      )}
    </div>
  );
}
