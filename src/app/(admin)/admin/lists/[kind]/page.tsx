"use client";

/**
 * Admin CMS — reference lists: areas (locations), employment statuses, and
 * skill sets. One page, switched by the `[kind]` segment
 * (/admin/lists/areas | statuses | skills). Backed by convex/lookups.ts.
 *
 * Add, rename, regroup, reorder, and archive without a code change. Archiving
 * hides an item from pickers but leaves existing profile values untouched.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Check,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import type { LookupKind } from "@/lib/use-lookup-options";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";
import { cn } from "@/lib/utils";
import { AdminPage } from "@/components/auf/admin-ui";

type Config = {
  kind: LookupKind;
  title: string;
  description: string;
  itemLabel: string;
  namePlaceholder: string;
  groupLabel: string | null;
  groupPlaceholder: string;
  showDescription: boolean;
  Icon: React.ComponentType<{ className?: string }>;
};

const CONFIGS: Record<string, Config> = {
  areas: {
    kind: "area",
    title: "Areas",
    description:
      "Locations alumni and employers pick from for city, headquarters, and job location.",
    itemLabel: "area",
    namePlaceholder: "e.g. Angeles City",
    groupLabel: "Region",
    groupPlaceholder: "e.g. Central Luzon",
    showDescription: false,
    Icon: MapPin,
  },
  statuses: {
    kind: "status",
    title: "Statuses",
    description:
      "Employment statuses alumni choose on their profile — used for tracer-study reporting.",
    itemLabel: "status",
    namePlaceholder: "e.g. Employed — full-time",
    groupLabel: null,
    groupPlaceholder: "",
    showDescription: true,
    Icon: BadgeCheck,
  },
  skills: {
    kind: "skill",
    title: "Skill sets",
    description:
      "Suggested skills shown when alumni add skills to their profile. Alumni can still type their own.",
    itemLabel: "skill",
    namePlaceholder: "e.g. Data Analysis",
    groupLabel: "Category",
    groupPlaceholder: "e.g. Technology",
    showDescription: false,
    Icon: Sparkles,
  },
};

type Item = {
  _id: string;
  name: string;
  group?: string;
  description?: string;
  sortOrder: number;
  archived: boolean;
};

export default function AdminReferenceListPage() {
  const params = useParams<{ kind: string }>();
  const config = CONFIGS[params.kind];

  if (!config) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          message="Unknown list"
          description="Choose Areas, Statuses, or Skill sets from the sidebar."
          cta={{ label: "Back to dashboard", href: "/admin/dashboard" }}
        />
      </div>
    );
  }
  // Key by kind so switching lists resets all local form state.
  return <ReferenceList key={config.kind} config={config} />;
}

function ReferenceList({ config }: { config: Config }) {
  const items = useQuery(api.lookups.adminList, { kind: config.kind }) as
    | Item[]
    | undefined;
  const create = useMutation(api.lookups.create);
  const update = useMutation(api.lookups.update);
  const setArchived = useMutation(api.lookups.setArchived);
  const move = useMutation(api.lookups.move);
  const seedDefaults = useMutation(api.lookups.seedDefaults);

  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const all = useMemo(() => items ?? [], [items]);
  const activeCount = all.filter((i) => !i.archived).length;
  const knownGroups = useMemo(
    () => [...new Set(all.map((i) => i.group).filter(Boolean) as string[])].sort(),
    [all],
  );
  const needle = filter.trim().toLowerCase();
  const visible = all.filter(
    (i) =>
      (showArchived || !i.archived) &&
      (!needle ||
        i.name.toLowerCase().includes(needle) ||
        (i.group ?? "").toLowerCase().includes(needle)),
  );
  // Reordering only makes sense on the full, unfiltered active list.
  const canReorder = !needle && !showArchived;

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      return false;
    }
  };

  const onAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const ok = await run(
      () =>
        create({
          kind: config.kind,
          name: name.trim(),
          group: group.trim() || undefined,
          description: description.trim() || undefined,
        }),
      `Added ${name.trim()}`,
    );
    setBusy(false);
    if (ok) {
      setName("");
      setDescription("");
    }
  };

  const startEdit = (i: Item) => {
    setEditId(i._id);
    setEditName(i.name);
    setEditGroup(i.group ?? "");
    setEditDescription(i.description ?? "");
  };

  const onSaveEdit = async (i: Item) => {
    const ok = await run(
      () =>
        update({
          itemId: i._id as never,
          name: editName.trim(),
          group: editGroup,
          description: editDescription,
        }),
      "Saved",
    );
    if (ok) setEditId(null);
  };

  const groupListId = `groups-${config.kind}`;

  return (
    <AdminPage
      title={config.title}
      description={config.description}
      width="narrow"
      actions={
        items !== undefined ? (
          <span className="text-[13px] text-muted-foreground">
            {activeCount} active
          </span>
        ) : undefined
      }
    >
      <p className="mt-1 text-xs text-muted-foreground">
        Other lists:{" "}
        {Object.entries(CONFIGS)
          .filter(([, c]) => c.kind !== config.kind)
          .map(([slug, c], idx) => (
            <span key={slug}>
              {idx > 0 && " · "}
              <Link href={`/admin/lists/${slug}`} className="underline-offset-2 hover:underline">
                {c.title}
              </Link>
            </span>
          ))}
        {" · "}
        <Link href="/admin/settings" className="underline-offset-2 hover:underline">
          Colleges &amp; programs
        </Link>
      </p>

      <datalist id={groupListId}>
        {knownGroups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {items === undefined ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : all.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <config.Icon className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="font-medium">No {config.title.toLowerCase()} yet</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Start from a suggested list, then edit as needed — or add your own below.
              </p>
            </div>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await run(() => seedDefaults({ kind: config.kind }), "Loaded defaults");
                setBusy(false);
              }}
            >
              <Plus className="h-4 w-4" />
              {busy ? "Loading…" : "Load suggested defaults"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Search ${config.title.toLowerCase()}…`}
              aria-label={`Search ${config.title.toLowerCase()}`}
              className="min-w-40 flex-1 sm:max-w-xs"
            />
            <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Show archived
            </label>
          </div>

          <div className="mt-3 space-y-1.5">
            {visible.map((i, idx) => (
              <Card key={i._id} className={cn(i.archived && "opacity-60")}>
                <CardContent className="p-3">
                  {editId === i._id ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          aria-label="Name"
                          className="min-w-40 flex-1"
                        />
                        {config.groupLabel && (
                          <Input
                            value={editGroup}
                            onChange={(e) => setEditGroup(e.target.value)}
                            placeholder={config.groupLabel}
                            aria-label={config.groupLabel}
                            list={groupListId}
                            className="w-44"
                          />
                        )}
                      </div>
                      {config.showDescription && (
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description (optional)"
                          aria-label="Description"
                        />
                      )}
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                          <X className="h-4 w-4" /> Cancel
                        </Button>
                        <Button size="sm" onClick={() => onSaveEdit(i)}>
                          <Check className="h-4 w-4" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{i.name}</span>
                          {i.group && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {i.group}
                            </span>
                          )}
                          {i.archived && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              Archived
                            </span>
                          )}
                        </div>
                        {i.description && (
                          <div className="text-[11px] text-muted-foreground">{i.description}</div>
                        )}
                      </div>
                      {canReorder && (
                        <>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Move ${i.name} up`}
                            disabled={idx === 0}
                            onClick={() => move({ itemId: i._id as never, direction: "up" })}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Move ${i.name} down`}
                            disabled={idx === visible.length - 1}
                            onClick={() => move({ itemId: i._id as never, direction: "down" })}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${i.name}`}
                        onClick={() => startEdit(i)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={i.archived ? `Restore ${i.name}` : `Archive ${i.name}`}
                        onClick={() =>
                          run(
                            () => setArchived({ itemId: i._id as never, archived: !i.archived }),
                            i.archived ? "Restored" : "Archived",
                          )
                        }
                      >
                        {i.archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {visible.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No matches.</p>
            )}
          </div>
        </>
      )}

      {/* Add item */}
      {items !== undefined && (
        <div className="mt-4 rounded-lg border border-dashed border-border p-3">
          <Label className="text-xs text-muted-foreground">Add {config.itemLabel}</Label>
          <div className="mt-1.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAdd()}
                placeholder={config.namePlaceholder}
                aria-label={`New ${config.itemLabel} name`}
                className="min-w-40 flex-1"
              />
              {config.groupLabel && (
                <Input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onAdd()}
                  placeholder={config.groupPlaceholder}
                  aria-label={config.groupLabel}
                  list={groupListId}
                  className="w-44"
                />
              )}
              <Button onClick={onAdd} disabled={busy || !name.trim()}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {config.showDescription && (
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAdd()}
                placeholder="Description (optional)"
                aria-label={`New ${config.itemLabel} description`}
              />
            )}
          </div>
        </div>
      )}
    </AdminPage>
  );
}
