"use client";

/**
 * Admin settings — academic taxonomy (colleges + courses/programs).
 *
 * The canonical, admin-managed source for the college/program lists alumni pick
 * from across the app (profile, verification) and admin filters. Add, rename,
 * re-home, and archive without a code change. Backed by convex/taxonomy.ts.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Archive,
  Building2,
  Check,
  GraduationCap,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminPage } from "@/components/auf/admin-ui";

const DEGREES = ["Undergraduate", "Graduate"] as const;

type College = {
  _id: string;
  name: string;
  shortName?: string;
  sortOrder: number;
  archived: boolean;
  programCount: number;
};
type Program = {
  _id: string;
  name: string;
  degree?: string;
  collegeId: string;
  sortOrder: number;
  archived: boolean;
};

export default function AdminSettingsPage() {
  const data = useQuery(api.taxonomy.adminList) as
    | { colleges: College[]; programs: Program[] }
    | undefined;
  const seedDefaults = useMutation(api.taxonomy.seedDefaults);
  const [seeding, setSeeding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const colleges = useMemo(() => data?.colleges ?? [], [data]);
  const programs = useMemo(() => data?.programs ?? [], [data]);
  const isEmpty = data !== undefined && colleges.length === 0;

  const activeColleges = useMemo(
    () => colleges.filter((c) => !c.archived),
    [colleges],
  );

  const onSeed = async () => {
    setSeeding(true);
    try {
      const res = (await seedDefaults({})) as
        | { seeded: boolean; colleges: number }
        | undefined;
      toast.success(
        res?.seeded
          ? `Loaded ${res.colleges} colleges with their programs`
          : "Taxonomy already has data — nothing to seed",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AdminPage
      title="Colleges & programmes"
      description="The colleges and programmes alumni choose from. Changes take effect immediately across profiles, verification and filters."
      width="narrow"
    >

      {data === undefined ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Loading taxonomy…
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <GraduationCap className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="font-medium">No colleges or programs yet</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Start from the standard AUF colleges + programs, then edit as
                needed.
              </p>
            </div>
            <Button onClick={onSeed} disabled={seeding}>
              <Plus className="h-4 w-4" />
              {seeding ? "Loading…" : "Load AUF defaults"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-end">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Show archived
            </label>
          </div>

          <div className="mt-2 grid gap-6 lg:grid-cols-2">
            <CollegesPanel
              colleges={colleges}
              programs={programs}
              showArchived={showArchived}
            />
            <ProgramsPanel
              colleges={colleges}
              activeColleges={activeColleges}
              programs={programs}
              showArchived={showArchived}
            />
          </div>
        </>
      )}
    </AdminPage>
  );
}

// ------------------------------------------------------------- colleges ---

function CollegesPanel({
  colleges,
  programs,
  showArchived,
}: {
  colleges: College[];
  programs: Program[];
  showArchived: boolean;
}) {
  const createCollege = useMutation(api.taxonomy.createCollege);
  const updateCollege = useMutation(api.taxonomy.updateCollege);
  const setArchived = useMutation(api.taxonomy.setCollegeArchived);

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShort, setEditShort] = useState("");

  const visible = colleges.filter((c) => showArchived || !c.archived);

  const onAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createCollege({
        name: name.trim(),
        shortName: shortName.trim() || undefined,
      });
      toast.success(`Added ${name.trim()}`);
      setName("");
      setShortName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (c: College) => {
    setEditId(c._id);
    setEditName(c.name);
    setEditShort(c.shortName ?? "");
  };
  const onSaveEdit = async (c: College) => {
    try {
      await updateCollege({
        collegeId: c._id as never,
        name: editName.trim(),
        shortName: editShort.trim(),
      });
      toast.success("College updated");
      setEditId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };
  const onArchive = async (c: College) => {
    const activePrograms = programs.filter(
      (p) => p.collegeId === c._id && !p.archived,
    ).length;
    if (
      !c.archived &&
      activePrograms > 0 &&
      !confirm(
        `Archive "${c.name}"? Its ${activePrograms} active program(s) will be hidden from pickers too.`,
      )
    ) {
      return;
    }
    try {
      await setArchived({ collegeId: c._id as never, archived: !c.archived });
      toast.success(c.archived ? "College restored" : "College archived");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Colleges</h2>
        <span className="text-xs text-muted-foreground">
          {colleges.filter((c) => !c.archived).length}
        </span>
      </div>

      <div className="space-y-1.5">
        {visible.map((c) => (
          <Card key={c._id} className={cn(c.archived && "opacity-60")}>
            <CardContent className="p-3">
              {editId === c._id ? (
                <div className="space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="College name"
                    aria-label="College name"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={editShort}
                      onChange={(e) => setEditShort(e.target.value)}
                      placeholder="Short (e.g. CCS)"
                      aria-label="College short name"
                      className="w-32"
                    />
                    <div className="ml-auto flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => onSaveEdit(c)}>
                        <Check className="h-4 w-4" /> Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {c.name}
                      </span>
                      {c.shortName && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {c.shortName}
                        </span>
                      )}
                      {c.archived && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.programCount} program{c.programCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => startEdit(c)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={c.archived ? `Restore ${c.name}` : `Archive ${c.name}`}
                    onClick={() => onArchive(c)}
                  >
                    {c.archived ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add college */}
      <div className="mt-3 rounded-lg border border-dashed border-border p-3">
        <Label className="text-xs text-muted-foreground">Add a college</Label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            placeholder="College of …"
            className="min-w-40 flex-1"
          />
          <Input
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            placeholder="Short"
            className="w-24"
          />
          <Button onClick={onAdd} disabled={busy || !name.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
    </section>
  );
}

// -------------------------------------------------------------- programs ---

function ProgramsPanel({
  colleges,
  activeColleges,
  programs,
  showArchived,
}: {
  colleges: College[];
  activeColleges: College[];
  programs: Program[];
  showArchived: boolean;
}) {
  const createProgram = useMutation(api.taxonomy.createProgram);
  const updateProgram = useMutation(api.taxonomy.updateProgram);
  const setArchived = useMutation(api.taxonomy.setProgramArchived);

  const [name, setName] = useState("");
  const [collegeId, setCollegeId] = useState<string>("");
  const [degree, setDegree] = useState<string>(DEGREES[0]);
  const [busy, setBusy] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCollegeId, setEditCollegeId] = useState("");
  const [editDegree, setEditDegree] = useState<string>(DEGREES[0]);

  const effectiveCollegeId = collegeId || activeColleges[0]?._id || "";

  // Group visible programs by college, in college sort order.
  const grouped = useMemo(() => {
    const visible = programs.filter((p) => showArchived || !p.archived);
    return colleges
      .filter((c) => showArchived || !c.archived)
      .map((c) => ({
        college: c,
        items: visible.filter((p) => p.collegeId === c._id),
      }))
      .filter((g) => g.items.length > 0);
  }, [programs, colleges, showArchived]);

  const onAdd = async () => {
    if (!name.trim() || !effectiveCollegeId) {
      toast.error("Program name and college are required");
      return;
    }
    setBusy(true);
    try {
      await createProgram({
        name: name.trim(),
        collegeId: effectiveCollegeId as never,
        degree,
      });
      toast.success(`Added ${name.trim()}`);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: Program) => {
    setEditId(p._id);
    setEditName(p.name);
    setEditCollegeId(p.collegeId);
    setEditDegree(p.degree ?? DEGREES[0]);
  };
  const onSaveEdit = async (p: Program) => {
    try {
      await updateProgram({
        programId: p._id as never,
        name: editName.trim(),
        collegeId: editCollegeId as never,
        degree: editDegree,
      });
      toast.success("Program updated");
      setEditId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };
  const onArchive = async (p: Program) => {
    try {
      await setArchived({ programId: p._id as never, archived: !p.archived });
      toast.success(p.archived ? "Program restored" : "Program archived");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Courses / Programs</h2>
        <span className="text-xs text-muted-foreground">
          {programs.filter((p) => !p.archived).length}
        </span>
      </div>

      <div className="space-y-3">
        {grouped.map(({ college, items }) => (
          <div key={college._id}>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {college.name}
              {college.archived && " (archived)"}
            </div>
            <div className="space-y-1.5">
              {items.map((p) => (
                <Card key={p._id} className={cn(p.archived && "opacity-60")}>
                  <CardContent className="p-3">
                    {editId === p._id ? (
                      <div className="space-y-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Program name"
                          aria-label="Program name"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={editCollegeId}
                            onChange={(e) => setEditCollegeId(e.target.value)}
                            aria-label="Program college"
                            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                          >
                            {activeColleges.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editDegree}
                            onChange={(e) => setEditDegree(e.target.value)}
                            aria-label="Program degree"
                            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                          >
                            {DEGREES.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          <div className="ml-auto flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={() => onSaveEdit(p)}>
                              <Check className="h-4 w-4" /> Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="truncate text-sm font-medium">
                            {p.name}
                          </span>
                          <div className="text-[11px] text-muted-foreground">
                            {p.degree ?? "—"}
                            {p.archived && " · archived"}
                          </div>
                        </div>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${p.name}`}
                          onClick={() => startEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={
                            p.archived ? `Restore ${p.name}` : `Archive ${p.name}`
                          }
                          onClick={() => onArchive(p)}
                        >
                          {p.archived ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No programs yet. Add one below.
          </p>
        )}
      </div>

      {/* Add program */}
      <div className="mt-3 rounded-lg border border-dashed border-border p-3">
        <Label className="text-xs text-muted-foreground">Add a program</Label>
        <div className="mt-1.5 space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            placeholder="BS …"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={effectiveCollegeId}
              onChange={(e) => setCollegeId(e.target.value)}
              aria-label="College for new program"
              className="min-w-40 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {activeColleges.length === 0 && (
                <option value="">Add a college first</option>
              )}
              {activeColleges.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              aria-label="Degree for new program"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {DEGREES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Button
              onClick={onAdd}
              disabled={busy || !name.trim() || !effectiveCollegeId}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
