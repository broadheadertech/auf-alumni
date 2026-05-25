"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Plus, X, Upload, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PrivacyTierIcon,
  type PrivacyTier as PrivacyTierType,
} from "@/components/auf/PrivacyTierIcon";
import { OpenToTag } from "@/components/auf/OpenToTag";
import {
  ProfilePreviewSwitcher,
  type PreviewViewer,
} from "@/components/auf/ProfilePreviewSwitcher";
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
  bio: string;
  skills: string[];
  openTo: OpenToKind[];
  experience: { role: string; company: string; years: string }[];
  education: {
    degree: string;
    program: string;
    school: string;
    year: number;
  }[];
  privacyTiers: Record<string, PrivacyTier>;
  excludeFromSearchEngines: boolean;
};

const DEFAULT_TIERS: Record<string, PrivacyTier> = {
  currentRole: "alumni",
  company: "alumni",
  city: "alumni",
  country: "public",
  bio: "alumni",
  skills: "alumni",
  experience: "alumni",
  education: "alumni",
};

const EMPTY: FormState = {
  displayName: "",
  batch: CURRENT_YEAR,
  program: PROGRAMS[0],
  degree: DEGREES[0],
  currentRole: "",
  company: "",
  city: "",
  country: "",
  bio: "",
  skills: [],
  openTo: [],
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

  const [state, setState] = useState<FormState>(EMPTY);
  const [skillInput, setSkillInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewerPreview, setViewerPreview] = useState<PreviewViewer>("self");
  const [hydratedId, setHydratedId] = useState<string | null>(null);

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
      bio: existing.bio ?? "",
      skills: existing.skills ?? [],
      openTo: (existing.openTo ?? []) as OpenToKind[],
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
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be 5 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
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
        bio: state.bio.trim() || undefined,
        skills: state.skills,
        openTo: state.openTo,
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
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
          {/* Photo */}
          <Card>
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
                    htmlFor="photo"
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
                    id="photo"
                    type="file"
                    accept="image/jpeg,image/png"
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
          <Card>
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
                      setState((s) => ({ ...s, program: v ?? PROGRAMS[0] }))
                    }
                  >
                    <SelectTrigger id="program">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROGRAMS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
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
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">Where you are now</h2>
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
                    onChange={(e) =>
                      setState((s) => ({ ...s, city: e.target.value }))
                    }
                  />
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
          <Card>
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
          <Card>
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
          <Card>
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
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addSkill}>
                    Add
                  </Button>
                </div>
              </FieldWithPrivacy>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardContent className="space-y-3 p-6">
              <FieldWithPrivacy
                label="Experience"
                fieldKey="experience"
                tier={state.privacyTiers.experience ?? "alumni"}
                onTier={(t) => updateTier("experience", t)}
                hidden={showHiddenInPreview("experience")}
              >
                <div className="space-y-3">
                  {state.experience.map((entry, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-border p-3"
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          placeholder="Role"
                          value={entry.role}
                          onChange={(e) => {
                            const next = [...state.experience];
                            next[idx] = { ...entry, role: e.target.value };
                            setState((s) => ({ ...s, experience: next }));
                          }}
                        />
                        <Input
                          placeholder="Company"
                          value={entry.company}
                          onChange={(e) => {
                            const next = [...state.experience];
                            next[idx] = { ...entry, company: e.target.value };
                            setState((s) => ({ ...s, experience: next }));
                          }}
                        />
                        <Input
                          placeholder="Years (e.g. 2020 – 2023)"
                          value={entry.years}
                          onChange={(e) => {
                            const next = [...state.experience];
                            next[idx] = { ...entry, years: e.target.value };
                            setState((s) => ({ ...s, experience: next }));
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
                            experience: s.experience.filter((_, i) => i !== idx),
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
                        experience: [
                          ...s.experience,
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
          <Card>
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
          <Card>
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
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </fieldset>
      </form>
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
