"use client";

/**
 * Admin CMS — article editor. Title, URL slug, category, excerpt, body, and
 * cover image, plus the publish lifecycle (draft ⇄ published → archived →
 * delete). Backed by convex/articles.ts.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Archive,
  ExternalLink,
  ImagePlus,
  Save,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";
import { cn } from "@/lib/utils";
import { DetailPage } from "@/components/auf/admin-ui";

type Article = {
  _id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  status: "draft" | "published" | "archived";
  publishedAt: number | null;
  updatedAt: number;
  coverUrl: string | null;
};

type Form = Pick<Article, "title" | "slug" | "excerpt" | "body" | "category">;

const STATUS_STYLE: Record<Article["status"], string> = {
  published: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  draft: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  archived: "bg-muted text-muted-foreground",
};

function toForm(a: Article): Form {
  return {
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    body: a.body,
    category: a.category,
  };
}

export default function AdminArticleEditorPage() {
  const params = useParams<{ articleId: string }>();
  const router = useRouter();
  const article = useQuery(api.articles.adminGet, {
    articleId: params.articleId as never,
  }) as Article | null | undefined;
  const update = useMutation(api.articles.update);
  const setStatus = useMutation(api.articles.setStatus);
  const remove = useMutation(api.articles.remove);
  const uploadUrl = useMutation(api.articles.generateCoverUploadUrl);
  const setCover = useMutation(api.articles.setCover);

  const [form, setForm] = useState<Form | null>(null);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Hydrate once per article so live query updates don't clobber edits.
  /* eslint-disable */
  useEffect(() => {
    if (!article || hydratedId === article._id) return;
    setHydratedId(article._id);
    setForm(toForm(article));
  }, [article, hydratedId]);
  /* eslint-enable */

  if (article === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          message="Article not found"
          description="It may have been deleted."
          cta={{ label: "Back to articles", href: "/admin/articles" }}
        />
      </div>
    );
  }
  if (article === undefined || form === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        Loading article…
      </div>
    );
  }

  const saved = toForm(article);
  const dirty = (Object.keys(form) as Array<keyof Form>).some(
    (k) => form[k] !== saved[k],
  );
  const set = (k: keyof Form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const persist = async (): Promise<boolean> => {
    try {
      const res = (await update({
        articleId: article._id as never,
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        body: form.body,
        category: form.category,
      })) as { slug: string } | undefined;
      // Server may normalise/dedupe the slug — reflect what was stored.
      if (res) setForm((f) => (f ? { ...f, slug: res.slug } : f));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      return false;
    }
  };

  const onSave = async () => {
    setBusy(true);
    if (await persist()) toast.success("Saved");
    setBusy(false);
  };

  const changeStatus = async (status: Article["status"], message: string) => {
    setBusy(true);
    try {
      if (dirty && !(await persist())) return;
      await setStatus({ articleId: article._id as never, status });
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!confirm(`Delete "${article.title}" permanently? This can't be undone.`)) return;
    setBusy(true);
    try {
      await remove({ articleId: article._id as never });
      toast.success("Article deleted");
      router.push("/admin/articles");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  };

  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Cover must be an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover image must be 5 MB or smaller");
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
      await setCover({ articleId: article._id as never, storageId: storageId as never });
      toast.success("Cover image updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <DetailPage
      backHref="/admin/articles"
      backLabel="Articles"
      width="narrow"
      title={form.title || "Untitled article"}
      badges={
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-medium capitalize",
            STATUS_STYLE[article.status],
          )}
        >
          {article.status}
        </span>
      }
      subtitle={
        <>
          {article.publishedAt
            ? `First published ${new Date(article.publishedAt).toLocaleDateString()} · `
            : ""}
          Last saved {new Date(article.updatedAt).toLocaleString()}
        </>
      }
      actions={
        article.status === "published" ? (
          <Link
            href={`/news/${article.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
          >
            View live <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : undefined
      }
    >

      <Card className="mt-4">
        <CardContent className="space-y-4 p-5">
          <div>
            <Label htmlFor="a-title">Title</Label>
            <Input id="a-title" value={form.title} onChange={set("title")} maxLength={160} className="mt-1.5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="a-slug">URL</Label>
              <div className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
                <span className="shrink-0">/news/</span>
                <Input id="a-slug" value={form.slug} onChange={set("slug")} maxLength={80} />
              </div>
            </div>
            <div>
              <Label htmlFor="a-category">Category</Label>
              <Input
                id="a-category"
                value={form.category}
                onChange={set("category")}
                maxLength={40}
                placeholder="e.g. Events, Milestone"
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="a-excerpt">Excerpt</Label>
            <Textarea
              id="a-excerpt"
              rows={2}
              value={form.excerpt}
              onChange={set("excerpt")}
              maxLength={300}
              placeholder="One or two sentences shown on the newsroom list."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="a-body">Body</Label>
            <Textarea
              id="a-body"
              rows={14}
              value={form.body}
              onChange={set("body")}
              maxLength={20000}
              className="mt-1.5 font-[inherit] leading-relaxed"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Plain text. Leave a blank line between paragraphs.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Cover image</h2>
            <span className="text-xs text-muted-foreground">Optional · up to 5 MB</span>
          </div>
          {article.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.coverUrl}
              alt=""
              className="mt-3 aspect-[2/1] w-full rounded-md border border-border object-cover"
            />
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Uploading…" : article.coverUrl ? "Replace image" : "Upload image"}
              <input type="file" accept="image/*" className="sr-only" onChange={onCoverChange} />
            </label>
            {article.coverUrl && (
              <Button
                variant="ghost"
                onClick={() =>
                  setCover({ articleId: article._id as never, storageId: undefined }).then(
                    () => toast.success("Cover removed"),
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

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {article.status !== "published" && (
          <Button variant="ghost" onClick={onDelete} disabled={busy} className="text-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
        {article.status === "draft" && (
          <Button variant="ghost" onClick={() => changeStatus("archived", "Article archived")} disabled={busy}>
            <Archive className="h-4 w-4" /> Archive
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={onSave} disabled={busy || !dirty}>
            <Save className="h-4 w-4" /> {dirty ? "Save" : "Saved"}
          </Button>
          {article.status === "published" ? (
            <Button variant="outline" onClick={() => changeStatus("draft", "Moved back to draft")} disabled={busy}>
              <Undo2 className="h-4 w-4" /> Unpublish
            </Button>
          ) : (
            <Button onClick={() => changeStatus("published", "Article published")} disabled={busy}>
              <Send className="h-4 w-4" />
              {article.status === "archived" ? "Restore & publish" : "Publish"}
            </Button>
          )}
        </div>
      </div>
    </DetailPage>
  );
}
