"use client";

/**
 * Admin CMS — Main page copy editor.
 *
 * Renders the field registry from convex/siteContent.ts (sections, labels,
 * length caps, defaults) as a form. Edits are local until "Save changes";
 * "Reset" restores a field's built-in default. The public homepage reads the
 * saved copy on its next request.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ExternalLink, LayoutTemplate, RotateCcw, Save } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_KEY = "home";

type Field = {
  key: string;
  label: string;
  help: string | null;
  multiline: boolean;
  max: number;
  default: string;
  value: string;
};
type PageData = {
  key: string;
  title: string;
  path: string;
  updatedAt: number | null;
  updatedByName: string | null;
  sections: Array<{ title: string; fields: Field[] }>;
};

export default function AdminContentPage() {
  const data = useQuery(api.siteContent.adminGet, { key: PAGE_KEY }) as
    | PageData
    | undefined;
  const save = useMutation(api.siteContent.save);

  // Only fields the admin has touched live here; everything else shows the
  // live server value, so concurrent edits by another admin still flow in.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fields = useMemo(
    () => new Map((data?.sections ?? []).flatMap((s) => s.fields).map((f) => [f.key, f])),
    [data],
  );
  const dirtyKeys = Object.keys(draft).filter(
    (k) => fields.has(k) && draft[k] !== fields.get(k)!.value,
  );
  const invalid = dirtyKeys.some((k) => {
    const v = draft[k].trim();
    return v.length === 0 || v.length > fields.get(k)!.max;
  });

  const onSave = async () => {
    if (dirtyKeys.length === 0) return;
    setSaving(true);
    try {
      await save({
        key: PAGE_KEY,
        fields: Object.fromEntries(dirtyKeys.map((k) => [k, draft[k]])),
      });
      toast.success("Main page updated");
      setDraft({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 pb-28">
      <div className="flex flex-wrap items-center gap-2">
        <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Main page</h1>
        <Link
          href="/"
          target="_blank"
          className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          View page <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Edit the text on the public homepage. Live figures (verified alumni,
        jobs, mentors) come from the database and aren&apos;t edited here.
      </p>
      {data?.updatedAt && (
        <p className="mt-1 text-xs text-muted-foreground">
          Last saved {new Date(data.updatedAt).toLocaleString()}
          {data.updatedByName ? ` by ${data.updatedByName}` : ""}
        </p>
      )}

      {data === undefined ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Loading content…
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {data.sections.map((section) => (
            <Card key={section.title}>
              <CardContent className="space-y-4 p-5">
                <h2 className="text-sm font-semibold">{section.title}</h2>
                {section.fields.map((f) => {
                  const value = draft[f.key] ?? f.value;
                  const id = `field-${f.key}`;
                  const tooLong = value.trim().length > f.max;
                  const empty = value.trim().length === 0;
                  const changed = value !== f.value;
                  const setValue = (next: string) =>
                    setDraft((d) => ({ ...d, [f.key]: next }));
                  return (
                    <div key={f.key}>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={id} className="text-xs">
                          {f.label}
                        </Label>
                        {changed && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                            Unsaved
                          </span>
                        )}
                        {value !== f.default && (
                          <button
                            type="button"
                            onClick={() => setValue(f.default)}
                            className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <RotateCcw className="h-3 w-3" /> Reset to default
                          </button>
                        )}
                      </div>
                      {f.multiline ? (
                        <Textarea
                          id={id}
                          rows={Math.min(6, Math.max(2, Math.ceil(f.max / 120)))}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          aria-invalid={tooLong || empty}
                          className="mt-1.5"
                        />
                      ) : (
                        <Input
                          id={id}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          aria-invalid={tooLong || empty}
                          className="mt-1.5"
                        />
                      )}
                      <div className="mt-1 flex gap-2 text-[11px] text-muted-foreground">
                        <span className={cn(empty && "text-destructive")}>
                          {empty ? "Required" : f.help}
                        </span>
                        <span className={cn("ml-auto tabular-nums", tooLong && "text-destructive")}>
                          {value.trim().length}/{f.max}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dirtyKeys.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
            <span className="text-sm text-muted-foreground">
              {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}
            </span>
            <Button variant="outline" className="ml-auto" onClick={() => setDraft({})} disabled={saving}>
              Discard
            </Button>
            <Button onClick={onSave} disabled={saving || invalid}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
