"use client";

/**
 * Employer roster — the admin's first view (Alumni Relations control room).
 *
 * Shows every partner employer with the fields the office asked for: name,
 * description, contract window, uploaded MOA/NDA, number of postings, and
 * number of applicants. Search + tier/contract filters + sortable columns.
 * Each row links to the per-employer drill-down (postings → applicants).
 *
 * Mock-data prototype for stakeholder review — see lib/mock-admin.ts.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  FileText,
  Plus,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import {
  EMPLOYERS,
  EMPLOYER_TIERS,
  applicantCount,
  contractState,
  fmtDate,
  hiredCount,
  postingCount,
  daysUntil,
  type AdminEmployer,
  type EmployerTier,
  type ContractState,
} from "@/lib/mock-admin";
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
import { ACCOUNT_STATUS_LABEL, useAccountStatusMap } from "@/lib/account-status";
import {
  DOC_STAMP,
  setEmployerDoc,
  useEmployerDocsMap,
} from "@/lib/employer-docs";
import { cn } from "@/lib/utils";

type SortKey =
  | "name"
  | "postings"
  | "applicants"
  | "hired"
  | "contractEnd";

const CONTRACT_FILTERS: { value: ContractState; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring ≤45d" },
  { value: "expired", label: "Expired" },
];

export default function AdminEmployersPage() {
  const statuses = useAccountStatusMap();
  const docsMap = useEmployerDocsMap();
  const [extra, setExtra] = useState<AdminEmployer[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tiers, setTiers] = useState<EmployerTier[]>([]);
  const [contracts, setContracts] = useState<ContractState[]>([]);
  const [sort, setSort] = useState<SortKey>("applicants");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const allEmployers = useMemo(() => [...extra, ...EMPLOYERS], [extra]);

  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allEmployers.filter((e) => {
      if (tiers.length && !tiers.includes(e.tier)) return false;
      if (contracts.length && !contracts.includes(contractState(e)))
        return false;
      if (q) {
        const hay = [e.name, e.description, e.industry, e.hqCity]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const val = (e: AdminEmployer): number | string => {
      switch (sort) {
        case "name":
          return e.name.toLowerCase();
        case "postings":
          return postingCount(e);
        case "applicants":
          return applicantCount(e);
        case "hired":
          return hiredCount(e);
        case "contractEnd":
          return daysUntil(e.contractEnd);
      }
    };
    list = [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [allEmployers, search, tiers, contracts, sort, dir]);

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
      postings: allEmployers.reduce((s, e) => s + postingCount(e), 0),
      applicants: allEmployers.reduce((s, e) => s + applicantCount(e), 0),
      hires: allEmployers.reduce((s, e) => s + hiredCount(e), 0),
    }),
    [allEmployers],
  );

  const activeFilters = tiers.length + contracts.length;

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
        <StatTile label="Employers" value={totals.employers} />
        <StatTile label="Active postings" value={totals.postings} />
        <StatTile label="Total applicants" value={totals.applicants} />
        <StatTile label="Hires via AUF" value={totals.hires} />
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="relative lg:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, industry, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <FilterChips
            label="Tier"
            options={EMPLOYER_TIERS.map((t) => ({ value: t, label: t }))}
            active={tiers}
            onToggle={(v) => toggle(tiers, v as EmployerTier, setTiers as (a: EmployerTier[]) => void)}
          />
          <FilterChips
            label="Contract"
            options={CONTRACT_FILTERS}
            active={contracts}
            onToggle={(v) =>
              toggle(contracts, v as ContractState, setContracts as (a: ContractState[]) => void)
            }
          />
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTiers([]);
                setContracts([]);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th label="Employer" sortKey="name" {...{ sort, dir, setSortKey }} />
                  <th className="px-3 py-2 text-left font-medium">Contract</th>
                  <th className="px-3 py-2 text-left font-medium">Documents</th>
                  <Th label="Postings" sortKey="postings" align="right" {...{ sort, dir, setSortKey }} />
                  <Th label="Applicants" sortKey="applicants" align="right" {...{ sort, dir, setSortKey }} />
                  <Th label="Hired" sortKey="hired" align="right" {...{ sort, dir, setSortKey }} />
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No employers match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((e) => (
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
                              {statuses[e.id] && (
                                <span
                                  className={cn(
                                    "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
                                    statuses[e.id].kind === "rejected"
                                      ? "bg-destructive/10 text-destructive"
                                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                                  )}
                                >
                                  {ACCOUNT_STATUS_LABEL[statuses[e.id].kind]}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 line-clamp-1 block max-w-md text-xs text-muted-foreground">
                              {e.description}
                            </span>
                            <span className="text-[11px] text-muted-foreground/80">
                              {e.industry} · {e.hqCity}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <ContractBadge state={contractState(e)} />
                        <div className="mt-1 text-xs text-muted-foreground">
                          {fmtDate(e.contractStart)} – {fmtDate(e.contractEnd)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <DocPill label="MOA" present={!!(docsMap[e.id]?.moa ?? e.moa)} />
                        <DocPill label="NDA" present={!!(docsMap[e.id]?.nda ?? e.nda)} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {postingCount(e)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {applicantCount(e)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {hiredCount(e)}
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

      <p className="mt-3 text-xs italic text-muted-foreground">
        Showing {rows.length} of {allEmployers.length} employers · demo data for
        stakeholder review.
      </p>

      <AddEmployerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(e) => setExtra((prev) => [e, ...prev])}
      />
    </div>
  );
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function AddEmployerDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (e: AdminEmployer) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [hqCity, setHqCity] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tier, setTier] = useState<EmployerTier>("Unverified");
  const [contractStart, setContractStart] = useState("2026-06-28");
  const [contractEnd, setContractEnd] = useState("2027-06-28");
  const [moaFile, setMoaFile] = useState<File | null>(null);
  const [ndaFile, setNdaFile] = useState<File | null>(null);
  const seq = useRef(0);
  const moaRef = useRef<HTMLInputElement>(null);
  const ndaRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setIndustry("");
    setHqCity("");
    setWebsiteUrl("");
    setTier("Unverified");
    setContractStart("2026-06-28");
    setContractEnd("2027-06-28");
    setMoaFile(null);
    setNdaFile(null);
    if (moaRef.current) moaRef.current.value = "";
    if (ndaRef.current) ndaRef.current.value = "";
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Organisation name is required");
      return;
    }
    if (contractEnd < contractStart) {
      toast.error("Contract end must be after the start");
      return;
    }
    const id = `emp-new-${seq.current++}`;
    const employer: AdminEmployer = {
      id,
      slug: slugify(name) || id,
      name: name.trim(),
      initials: initialsOf(name),
      description: description.trim() || "No description provided yet.",
      industry: industry.trim() || "—",
      hqCity: hqCity.trim() || "—",
      websiteUrl: websiteUrl.trim() || "#",
      tier,
      contractStart,
      contractEnd,
      moa: null,
      nda: null,
      onboardedAt: "2026-06-28",
      postings: [],
    };
    onCreate(employer);
    if (moaFile) {
      setEmployerDoc(id, "moa", {
        filename: moaFile.name,
        sizeKb: Math.max(1, Math.round(moaFile.size / 1024)),
        uploadedAt: DOC_STAMP,
      });
    }
    if (ndaFile) {
      setEmployerDoc(id, "nda", {
        filename: ndaFile.name,
        sizeKb: Math.max(1, Math.round(ndaFile.size / 1024)),
        uploadedAt: DOC_STAMP,
      });
    }
    toast.success(`${employer.name} onboarded`);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
              <Input id="ae-ind" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Telecommunications" />
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
              <input id="ae-cs" type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            </div>
            <div>
              <Label htmlFor="ae-ce" className="text-xs">Contract end</Label>
              <input id="ae-ce" type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            </div>
          </div>

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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>
            <Plus className="h-4 w-4" />
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

function FilterChips<T extends string>({
  label,
  options,
  active,
  onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  active: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div>
      <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = active.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
