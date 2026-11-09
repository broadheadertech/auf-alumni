/**
 * Newsroom article page. Server-rendered from convex/articles.ts — only
 * published articles resolve; drafts and archived articles 404.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/convex-api";
import { formatArticleDate, toParagraphs } from "@/lib/article-format";

type Params = Promise<{ slug: string }>;

type Article = {
  _id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string | null;
  publishedAt: number;
  coverUrl: string | null;
};

async function loadArticle(slug: string): Promise<Article | null> {
  try {
    return (await fetchQuery(api.articles.getPublishedBySlug, { slug })) as Article | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadArticle(slug);
  if (!article) return { title: "Article not found — AUF Alumni Network" };
  return {
    title: `${article.title} — AUF Alumni Network`,
    description: article.excerpt ?? toParagraphs(article.body)[0]?.slice(0, 160),
  };
}

export default async function NewsArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const article = await loadArticle(slug);
  if (!article) notFound();

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-[13px] ink-3 hover:underline underline-offset-4"
      >
        <ArrowLeft size={14} /> Newsroom
      </Link>

      <div className="flex flex-wrap items-center gap-2 mt-6">
        <span className="auf-chip auf-chip-brand text-[11px] font-medium">
          {formatArticleDate(article.publishedAt)}
        </span>
        {article.category && <span className="auf-chip text-[11px]">{article.category}</span>}
      </div>
      <h1 className="font-serif text-[34px] sm:text-[44px] leading-tight font-semibold mt-4">
        {article.title}
      </h1>
      {article.excerpt && (
        <p className="text-[18px] ink-2 mt-4 leading-[1.6]">{article.excerpt}</p>
      )}

      {article.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.coverUrl}
          alt=""
          className="mt-8 aspect-[2/1] w-full rounded-xl object-cover"
        />
      )}

      <div className="mt-8 space-y-5">
        {toParagraphs(article.body).map((p, i) => (
          <p key={i} className="text-[16px] ink-2 leading-[1.8] whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
