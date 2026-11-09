"use client";

/**
 * Employer roster — the admin's first view (Alumni Relations control room).
 *
 * Shows every employer organisation with the fields the office asked for:
 * name, description, contract window, uploaded MOA/NDA, number of postings,
 * and number of applicants. Standard FilterPanel (search, tier, contract,
 * industry, HQ city, documents; URL-backed and persisted for the session) +
 * sortable columns. Each row links to the per-employer drill-down
 * (postings → applicants).
 *
 * Live data: convex/adminData.ts `employers` (employerOrgs · jobs ·
 * applications). "Add employer" calls adminEmployers.onboardEmployer and
 * uploads any attached MOA / NDA to Convex storage.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Upload,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { useAsOf } from "@/lib/use-as-of";
import { EMPLOYER_TIERS, fmtDate, type EmployerTier } from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContractBadge,
  StatTile,
  TierBadge,
} from "@/components/auf/AdminBits";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE } from "@/lib/account-status";
import { useUrlFilters } from "@/lib/use-url-filters";
import { useLookupOptions } from "@/lib/use-lookup-options";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/auf/Pagination";
import { usePagination } from "@/lib/use-pagination";

type EmployerView = FunctionReturnType<typeof api.adminData.employers>[number];
type ContractFilter = EmployerView["contractState"];

type SortKey =
  | "name"
  | "postings"
  | "applicants"
  | "hired"
  | "contractEnd";

const CONTRACT_FILTERS: { value: ContractFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring ≤45d" },
  { value: "expired", label: "Expired" },
  { value: "none", label: "No contract on file" },
];

const FILTER_KEYS = ["q", "tier", "contract", "industry", "city", "docs"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const applicantsOf = (e: EmployerView) =>
  e.postings.reduce((sum, p) => sum + p.applicants.length, 0);
const hiredOf = (e: EmployerView) =>
  e.postings.reduce(
    (sum, p) => sum + p.applicants.filter((a) => a.stage === "hired").length,
    0,
  );

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data = err.data as { message?: string } | string;
    return typeof data === "string" ? data : data?.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

export default function AdminEmployersPage() {
  const asOf = useAsOf();
  const employers = useQuery(api.adminData.employers, { asOf });
  const loading = employers === undefined;
  const allEmployers = useMemo(() => employers ?? [], [employers]);
  const [addOpen, setAddOpen] = useState(false);
  const { values, set, reset, restored } = useUrlFilters("admin-employers", FILTER_KEYS);
  const areas = useLookupOptions("area");
  const [sort, setSort] = useState<SortKey>("applicants");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const q = values.q.trim().toLowerCase();
    let list = allEmployers.filter((e) => {
      if (values.tier && e.tier !== values.tier) return false;
      if (values.contract && e.contractState !== values.contract) return false;
      if (values.industry && e.industry !== values.industry) return false;
      if (values.city && e.hqCity !== values.city) return false;
      if (values.docs) {
        const moa = !!e.moa;
        const nda = !!e.nda;
        if (values.docs === "complete" && !(moa && nda)) return false;
        if (values.docs === "missing-moa" && moa) return false;
        if (values.docs === "missing-nda" && nda) return false;
      }
      if (q) {
        const hay = [e.name, e.description, e.industry, e.hqCity]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const val = (e: EmployerView): number | string => {
      switch (sort) {
        case "name":
          return e.name.toLowerCase();
        case "postings":
          return e.postings.length;
        case "applicants":
          return applicantsOf(e);
        case "hired":
          return hiredOf(e);
        case "contractEnd":
          // No contract on file sorts after every dated contract.
          return e.contractEnd ?? "9999-12-31";
      }
    };
    list = [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [allEmployers, values, sort, dir]);

  const paged = usePagination(rows, {
    resetKey: Object.values(values).join("|"),
  });

  const setSortKey = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "name" ? "asc" : "desc");
    }
  };

  const totals = useMemo(
    () => ({
      employers: allEmployers.length,
      postings: allEmployers.reduce(
        (s, e) => s + e.postings.filter((p) => p.status === "published").length,
        0,
      ),
      applicants: allEmployers.reduce((s, e) => s + applicantsOf(e), 0),
      hires: allEmployers.reduce((s, e) => s + hiredOf(e), 0),
    }),
    [allEmployers],
  );

  const industryOptions = useMemo(
    () =>
      Array.from(new Set(allEmployers.map((e) => e.industry)))
        .filter(Boolean)
        .sort(),
    [allEmployers],
  );

  // HQ city: the admin-managed areas list first, then any city present in the
  // employer records that isn't in it.
  const cityOptions = useMemo(() => {
    const known = new Set(areas.options.map((a) => a.name));
    const extraCities = Array.from(new Set(allEmployers.map((e) => e.hqCity)))
      .filter((c) => c && !known.has(c))
      .sort();
    return [
      ...areas.options.map((a) => ({ value: a.name, label: a.name, group: a.group })),
      ...extraCities.map((c) => ({
        value: c,
        label: c,
        group: known.size ? "Other" : undefined,
      })),
    ];
  }, [areas.options, allEmployers]);

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Search name, industry, city…" },
    {
      type: "select",
      key: "tier",
      label: "Tier",
      allLabel: "All tiers",
      options: EMPLOYER_TIERS.map((t) => ({ value: t, label: t })),
    },
    {
      type: "select",
      key: "contract",
      label: "Contract status",
      allLabel: "Any contract status",
      options: CONTRACT_FILTERS,
    },
    {
      type: "select",
      key: "industry",
      label: "Industry",
      allLabel: "All industries",
      options: industryOptions.map((i) => ({ value: i, label: i })),
    },
    {
      type: "select",
      key: "city",
      label: "HQ city",
      allLabel: "All cities",
      options: cityOptions,
    },
    {
      type: "select",
      key: "docs",
      label: "Documents",
      allLabel: "Any documents",
      options: [
        { value: "complete", label: "MOA and NDA on file" },
        { value: "missing-moa", label: "Missing MOA" },
        { value: "missing-nda", label: "Missing NDA" },
      ],
    },
  ];

  const tile = (n: number) => (loading ? "—" : n);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Partner organisations, their contracts, documents, and hiring
            activity.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add employer
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Employers" value={tile(totals.employers)} />
        <StatTile label="Active postings" value={tile(totals.postings)} />
        <StatTile label="Total applicants" value={tile(totals.applicants)} />
        <StatTile label="Hires via AUF" value={tile(totals.hires)} />
      </div>

      {/* Filters */}
      <FilterPanel
        layout="bar"
        className="mt-6"
        fields={fields}
        values={values}
        onChange={(k, v) => set(k as FilterKey, v)}
        onReset={reset}
        restored={restored}
      />

      {/* Table */}
      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th label="Employer" sortKey="name" {...{ sort, dir, setSortKey }} />
                  <Th label="Contract" sortKey="contractEnd" {...{ sort, dir, setSortKey }} />
                  <th className="px-3 py-2 text-left font-medium">Documents</th>
                  <Th label="Postings" sortKey="postings" align="right" {...{ sort, dir, setSortKey }} />
                  <Th label="Applicants" sortKey="applicants" align="right" {...{ sort, dir, setSortKey }} />
                  <Th label="Hired" sortKey="hired" align="right" {...{ sort, dir, setSortKey }} />
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Loading employers…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      {allEmployers.length === 0 ? (
                        "No employers onboarded yet."
                      ) : (
                        <>
                          No employers match these filters.{" "}
                          <button
                            type="button"
                            onClick={reset}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            Reset filters
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  paged.pageItems.map((e) => (
                    <tr
                      key={e.id}
                      className="group border-b border-border align-top last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-3">
                        <Link href={`/admin/employers/${e.id}`} className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">
                            {e.initials}
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium group-hover:underline">
                                {e.name}
                              </span>
                              <TierBadge tier={e.tier} />
                              {e.accountStatus && (
                                <span
                                  className={cn(
                                    "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
                                    ACCOUNT_STATUS_TONE[e.accountStatus.kind],
                                  )}
                                >
                                  {ACCOUNT_STATUS_LABEL[e.accountStatus.kind]}
                                </span>
                              )}
                            </span>
                            {e.description && (
                              <span className="mt-0.5 line-clamp-1 block max-w-md text-xs text-muted-foreground">
                                {e.description}
                              </span>
                            )}
                            {(e.industry || e.hqCity) && (
                              <span className="text-[11px] text-muted-foreground/80">
                                {[e.industry, e.hqCity].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <ContractBadge state={e.contractState} />
                        {(e.contractStart || e.contractEnd) && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {e.contractStart ? fmtDate(e.contractStart) : "—"} –{" "}
                            {e.contractEnd ? fmtDate(e.contractEnd) : "—"}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <DocPill label="MOA" present={!!e.moa} />
                        <DocPill label="NDA" present={!!e.nda} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {e.postings.length}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {applicantsOf(e)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {hiredOf(e)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/admin/employers/${e.id}`}
                          className="inline-flex text-muted-foreground hover:text-foreground"
                          aria-label={`Open ${e.name}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {!loading && (
        <Pagination
          state={paged}
          noun={
            paged.total === allEmployers.length
              ? "employer"
              : `matching employer (of ${allEmployers.length})`
          }
        />
      )}

      <AddEmployerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        industryOptions={industryOptions}
      />
    </div>
  );
}

const TIER_VALUE: Record<EmployerTier, "partner" | "verified" | "unverified"> = {
  Partner: "partner",
  Verified: "verified",
  Unverified: "unverified",
};

function AddEmployerDialog({
  open,
  onClose,
  industryOptions,
}: {
  open: boolean;
  onClose: () => void;
  /** Industries already used by employerOrgs — suggested so labels stay consistent. */
  industryOptions: string[];
}) {
  const onboard = useMutation(api.adminEmployers.onboardEmployer);
  const uploadUrl = useMutation(api.adminEmployers.generateDocumentUploadUrl);
  const setDocument = useMutation(api.adminEmployers.setEmployerDocument);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [hqCity, setHqCity] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tier, setTier] = useState<EmployerTier>("Unverified");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [moaFile, setMoaFile] = useState<File | null>(null);
  const [ndaFile, setNdaFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const moaRef = useRef<HTMLInputElement>(null);
  const ndaRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setIndustry("");
    setHqCity("");
    setWebsiteUrl("");
    setTier("Unverified");
    setContractStart("");
    setContractEnd("");
    setMoaFile(null);
    setNdaFile(null);
    if (moaRef.current) moaRef.current.value = "";
    if (ndaRef.current) ndaRef.current.value = "";
  };

  const attach = async (
    employerOrgId: string,
    kind: "moa" | "nda",
    file: File,
  ) => {
    const url = await uploadUrl({});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) throw new Error(`${kind.toUpperCase()} upload failed`);
    const { storageId } = (await res.json()) as { storageId: string };
    await setDocument({
      employerOrgId: employerOrgId as never,
      kind,
      filename: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      storageId: storageId as never,
    });
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Organisation name is required");
      return;
    }
    if (contractStart && contractEnd && contractEnd < contractStart) {
      toast.error("Contract end must be after the start");
      return;
    }
    setBusy(true);
    try {
      const created = await onboard({
        name: name.trim(),
        description: description.trim() || undefined,
        industry: industry.trim() || undefined,
        hqCity: hqCity.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        tier: TIER_VALUE[tier],
        contractStart: contractStart || undefined,
        contractEnd: contractEnd || undefined,
      });
      if (!created) throw new Error("Could not add employer");
      const { employerOrgId } = created;
      const uploads: [("moa" | "nda"), File][] = [];
      if (moaFile) uploads.push(["moa", moaFile]);
      if (ndaFile) uploads.push(["nda", ndaFile]);
      const failed: string[] = [];
      for (const [kind, file] of uploads) {
        try {
          await attach(employerOrgId, kind, file);
        } catch {
          failed.push(kind.toUpperCase());
        }
      }
      if (failed.length) {
        toast.warning(`${name.trim()} onboarded`, {
          description: `${failed.join(" and ")} could not be uploaded — add it from the employer's page.`,
        });
      } else {
        toast.success(`${name.trim()} onboarded`);
      }
      reset();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Could not add employer"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add employer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ae-name" className="text-xs">Organisation name *</Label>
            <Input id="ae-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Globe Telecom" />
          </div>
          <div>
            <Label htmlFor="ae-desc" className="text-xs">Description</Label>
            <Textarea id="ae-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the organisation does and who they hire." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ae-ind" className="text-xs">Industry</Label>
              <Input
                id="ae-ind"
                list="ae-industry-options"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Telecommunications"
              />
              <datalist id="ae-industry-options">
                {industryOptions.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="ae-city" className="text-xs">HQ city</Label>
              <Input id="ae-city" value={hqCity} onChange={(e) => setHqCity(e.target.value)} placeholder="Taguig" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ae-web" className="text-xs">Website</Label>
              <Input id="ae-web" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <Label htmlFor="ae-tier" className="text-xs">Tier</Label>
              <select
                id="ae-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as EmployerTier)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              >
                {EMPLOYER_TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ae-cs" className="text-xs">Contract start</Label>
              <input id="ae-cs" type="date" value={contractStart} max={contractEnd || undefined} onChange={(e) => setContractStart(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            </div>
            <div>
              <Label htmlFor="ae-ce" className="text-xs">Contract end</Label>
              <input id="ae-ce" type="date" value={contractEnd} min={contractStart || undefined} onChange={(e) => setContractEnd(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Leave the contract dates blank if no agreement is signed yet.
          </p>

          {/* Optional document uploads */}
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium">Documents (optional)</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Upload the MOA / NDA if signed. You can leave these for later and
              add them from the employer&apos;s page once the paperwork is ready.
            </p>
            <div className="mt-2 space-y-2">
              <UploadRow label="MOA" file={moaFile} inputRef={moaRef} onPick={setMoaFile} />
              <UploadRow label="NDA" file={ndaFile} inputRef={ndaRef} onPick={setNdaFile} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add employer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadRow({
  label,
  file,
  inputRef,
  onPick,
}: {
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (f: File | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="font-medium">{label}</span>
          <span className="ml-1 truncate text-xs text-muted-foreground">
            {file ? file.name : "not attached"}
          </span>
        </span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (!/\.(pdf|doc|docx)$/i.test(f.name)) {
            toast.error("MOA / NDA must be a PDF, DOC, or DOCX");
            return;
          }
          onPick(f);
        }}
      />
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> {file ? "Change" : "Attach"}
        </Button>
        {file && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onPick(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

function Th({
  label,
  sortKey,
  sort,
  dir,
  setSortKey,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  setSortKey: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === sortKey;
  return (
    <th className={cn("px-3 py-2 font-medium", align === "right" ? "text-right" : "text-left")}>
      <button
        type="button"
        onClick={() => setSortKey(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
        {active && <span className="sr-only">{dir}</span>}
      </button>
    </th>
  );
}

function DocPill({ label, present }: { label: string; present: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        present ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
      )}
    >
      {present ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      <FileText className="h-3 w-3" />
      {label}
    </div>
  );
}
