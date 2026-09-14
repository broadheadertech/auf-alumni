"use client";

/**
 * Admin CMS — Articles (newsroom) list. Create a draft, then edit it at
 * /admin/articles/[articleId]. Backed by convex/articles.ts.
 *
 * Standard FilterPanel (search, status with per-status counts, category from
 * the categories in use; URL-backed and persisted for the session).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ExternalLink, Newspaper, Plus } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import { useUrlFilters } from "@/lib/use-url-filters";
import { cn } from "@/lib/utils";

type Row = {
  _id: string;
  slug: string;
  title: string;
  category: string | null;
  status: "draft" | "published" | "archived";
  publishedAt: number | null;
  updatedAt: number;
};

const STATUSES = ["published", "draft", "archived"] as const;
type Filter = "all" | (typeof STATUSES)[number];

const STATUS_LABEL: Record<Row["status"], string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

const STATUS_STYLE: Record<Row["status"], string> = {
  published: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  draft: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  archived: "bg-muted text-muted-foreground",
};

const FILTER_KEYS = ["q", "status", "category"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export default function AdminArticlesPage() {
  const router = useRouter();
  const rows = useQuery(api.articles.adminList) as Row[] | undefined;
  const createDraft = useMutation(api.articles.createDraft);
  const seedSamples = useMutation(api.articles.seedSamples);

  const { values, set, reset, restored } = useUrlFilters("admin-articles", FILTER_KEYS);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, published: 0, draft: 0, archived: 0 };
    for (const r of rows ?? []) {
      c.all++;
      c[r.status]++;
    }
    return c;
  }, [rows]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set((rows ?? []).map((r) => r.category).filter((c): c is string => !!c)),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const needle = values.q.trim().toLowerCase();
  const visible = (rows ?? []).filter(
    (r) =>
      (!values.status || r.status === values.status) &&
      (!values.category || r.category === values.category) &&
      (!needle ||
        r.title.toLowerCase().includes(needle) ||
        (r.category ?? "").toLowerCase().includes(needle)),
  );

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Search title or category…" },
    {
      type: "select",
      key: "status",
      label: "Status",
      allLabel: `All statuses (${counts.all})`,
      options: STATUSES.map((s) => ({
        value: s,
        label: `${STATUS_LABEL[s]} (${counts[s]})`,
      })),
    },
    {
      type: "select",
      key: "category",
      label: "Category",
      allLabel: "All categories",
      options: categories.map((c) => ({ value: c, label: c })),
    },
  ];

  const onNew = async () => {
    setBusy(true);
    try {
      const res = (await createDraft({})) as { articleId: string } | undefined;
      if (res) router.push(`/admin/articles/${res.articleId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create article");
      setBusy(false);
    }
  };

  const onSeed = async () => {
    setBusy(true);
    try {
      await seedSamples({});
      toast.success("Loaded sample articles");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load samples");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-2">
        <Newspaper className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Articles</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/news"
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Newsroom <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Button onClick={onNew} disabled={busy}>
            <Plus className="h-4 w-4" /> New article
          </Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        News and announcements shown on the public newsroom. Only published
        articles are visible to visitors.
      </p>

      {rows === undefined ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Loading articles…
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Newspaper className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="font-medium">No articles yet</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Write your first article, or load three sample articles to see how the newsroom looks.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onSeed} disabled={busy}>
                Load samples
              </Button>
              <Button onClick={onNew} disabled={busy}>
                <Plus className="h-4 w-4" /> New article
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <FilterPanel
            layout="bar"
            className="mt-5"
            fields={fields}
            values={values}
            onChange={(k, v) => set(k as FilterKey, v)}
            onReset={reset}
            restored={restored}
          />

          <div className="mt-3 space-y-1.5">
            {visible.map((r) => (
              <Link key={r._id} href={`/admin/articles/${r._id}`} className="block">
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.category ? `${r.category} · ` : ""}
                        {r.status === "published" && r.publishedAt
                          ? `Published ${new Date(r.publishedAt).toLocaleDateString()}`
                          : `Edited ${new Date(r.updatedAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                        STATUS_STYLE[r.status],
                      )}
                    >
                      {r.status}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {visible.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No matching articles.{" "}
                <button
                  type="button"
                  onClick={reset}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Reset filters
                </button>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
