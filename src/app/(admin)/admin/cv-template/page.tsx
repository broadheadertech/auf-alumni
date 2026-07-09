"use client";

/**
 * Admin CV template manager — the AUF-provided official CV template.
 *
 * Configure branding (band colour, org name, subtitle, tagline), the
 * verification watermark + seal, the footer line, and the per-section policy
 * (required / optional / hidden). Saved to localStorage so the alumni CV
 * generator (/resume/preview) picks it up. A live band preview shows the
 * branding as alumni will see it.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, RotateCcw, Save, ShieldCheck, Stamp } from "lucide-react";
import {
  CV_ACCENTS,
  CV_SECTIONS,
  DEFAULT_CV_TEMPLATE,
  loadCvTemplate,
  saveCvTemplate,
  type CvAccent,
  type CvSection,
  type CvTemplateConfig,
  type SectionPolicy,
} from "@/lib/cv-template";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLICIES: { value: SectionPolicy; label: string }[] = [
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "hidden", label: "Hidden" },
];

export default function AdminCvTemplatePage() {
  const [cfg, setCfg] = useState<CvTemplateConfig>(DEFAULT_CV_TEMPLATE);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate saved template from localStorage after mount
    setCfg(loadCvTemplate());
  }, []);

  const update = (patch: Partial<CvTemplateConfig>) => {
    setCfg((c) => ({ ...c, ...patch }));
    setDirty(true);
  };
  const setSection = (key: CvSection, policy: SectionPolicy) => {
    setCfg((c) => ({ ...c, sections: { ...c.sections, [key]: policy } }));
    setDirty(true);
  };

  const onSave = () => {
    saveCvTemplate(cfg);
    setDirty(false);
    toast.success("CV template saved — alumni CVs now use it");
  };
  const onReset = () => {
    setCfg(DEFAULT_CV_TEMPLATE);
    setDirty(true);
    toast.message("Reverted to defaults — Save to apply");
  };

  const accentHex = CV_ACCENTS[cfg.accent].hex;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Stamp className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">CV template</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button size="sm" onClick={onSave} disabled={!dirty}>
            <Save className="h-4 w-4" />
            {dirty ? "Save template" : "Saved"}
          </Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        The official AUF CV template. Alumni generate their CV against this — set
        the branding, verification marks, and which sections they may include.
      </p>

      {/* Live band preview */}
      <Card className="mt-5 overflow-hidden">
        <div
          className="flex items-center justify-between gap-4 px-6 py-4 text-white"
          style={{ background: accentHex }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "var(--gold)", color: accentHex }}
            >
              AUF
            </span>
            <div className="leading-tight">
              <div className="font-serif text-sm font-semibold tracking-wide">
                {cfg.orgName || "Organisation name"}
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">
                {cfg.subtitle}
              </div>
            </div>
          </div>
          {cfg.sealEnabled && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--gold)", color: accentHex }}
            >
              <ShieldCheck size={11} /> VERIFIED ALUMNUS
            </span>
          )}
        </div>
        <CardContent className="flex items-center justify-between gap-3 p-3">
          <span className="text-xs text-muted-foreground">
            {cfg.tagline || "Live preview of the CV header band"}
            {cfg.watermarkEnabled && ` · watermark: “${cfg.watermarkText}”`}
          </span>
          <Link
            href="/resume/preview"
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Preview full CV <ExternalLink className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Branding */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-medium">Branding</h2>
            <div>
              <Label className="text-xs">Band colour</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(Object.keys(CV_ACCENTS) as CvAccent[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => update({ accent: a })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                      cfg.accent === a ? "border-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: CV_ACCENTS[a].hex }} />
                    {CV_ACCENTS[a].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="org" className="text-xs">Organisation name</Label>
              <Input id="org" value={cfg.orgName} onChange={(e) => update({ orgName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="sub" className="text-xs">Subtitle</Label>
              <Input id="sub" value={cfg.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="tag" className="text-xs">Tagline (optional)</Label>
              <Input id="tag" value={cfg.tagline} placeholder="e.g. Est. 1962 · A Catholic university" onChange={(e) => update({ tagline: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="foot" className="text-xs">Footer line</Label>
              <Input id="foot" value={cfg.footerText} onChange={(e) => update({ footerText: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {/* Verification + sections */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <h2 className="text-sm font-medium">Verification marks</h2>
              <div className="mt-2 space-y-2">
                <Toggle
                  label="Verified-alumnus seal"
                  hint="Gold seal + Alumni ID in the header band"
                  checked={cfg.sealEnabled}
                  onChange={(v) => update({ sealEnabled: v })}
                />
                <Toggle
                  label="Security watermark"
                  hint="Tiled mark across the page"
                  checked={cfg.watermarkEnabled}
                  onChange={(v) => update({ watermarkEnabled: v })}
                />
                <div className={cfg.watermarkEnabled ? "" : "opacity-40"}>
                  <Label htmlFor="wm" className="text-xs">Watermark text</Label>
                  <Input
                    id="wm"
                    value={cfg.watermarkText}
                    disabled={!cfg.watermarkEnabled}
                    onChange={(e) => update({ watermarkText: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium">Sections</h2>
              <p className="text-[11px] text-muted-foreground">
                Required = always on · Optional = alumna chooses · Hidden = not offered
              </p>
              <div className="mt-2 space-y-2">
                {CV_SECTIONS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{label}</span>
                    <div className="flex rounded-md border border-border p-0.5">
                      {POLICIES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setSection(key, p.value)}
                          className={cn(
                            "rounded px-2 py-0.5 text-[11px] transition-colors",
                            cfg.sections[key] === p.value
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs italic text-muted-foreground">
        Saved to this browser for the prototype. When wired to the backend this
        becomes a single org-wide template all alumni CVs inherit.
      </p>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-border"
      />
    </label>
  );
}
