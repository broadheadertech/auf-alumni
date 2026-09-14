import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/convex-api";
import { formatArticleDate } from "@/lib/article-format";

export const metadata: Metadata = {
  title: "Newsroom — AUF Alumni Network",
  description:
    "Updates from the AUF Alumni Network — verified-member milestones, employer partner launches, and upcoming alumni events.",
};

type ArticleCard = {
  _id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  publishedAt: number;
  coverUrl: string | null;
};

async function loadArticles(): Promise<ArticleCard[]> {
  try {
    return (await fetchQuery(api.articles.listPublished, {})) as ArticleCard[];
  } catch {
    return [];
  }
}

export default async function NewsPage() {
  const articles = await loadArticles();

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">Newsroom</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        What&apos;s happening at AUF Alumni.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Milestones, employer partner launches, and the events worth blocking
        on your calendar — from the Office of Alumni Relations.
      </p>

      {articles.length === 0 ? (
        <div className="auf-card p-10 mt-12 text-center">
          <div className="font-serif text-[20px] font-semibold">No news yet.</div>
          <p className="text-[14px] ink-2 mt-2">
            Check back soon for updates from the AUF alumni community.
          </p>
        </div>
      ) : (
        <section className="mt-12 space-y-4">
          {articles.map((a) => (
            <Link
              key={a._id}
              href={`/news/${a.slug}`}
              className="auf-card block overflow-hidden hover:shadow-md transition"
            >
              {a.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.coverUrl} alt="" className="aspect-[3/1] w-full object-cover" />
              )}
              <article className="p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="auf-chip auf-chip-brand text-[11px] font-medium">
                    {formatArticleDate(a.publishedAt)}
                  </span>
                  {a.category && (
                    <span className="auf-chip text-[11px]">{a.category}</span>
                  )}
                </div>
                <h2 className="font-serif text-[22px] font-semibold mt-3">{a.title}</h2>
                {a.excerpt && (
                  <p className="text-[15px] ink-2 mt-2 leading-[1.7]">{a.excerpt}</p>
                )}
                <span className="brand-fg text-[13px] font-medium mt-3 inline-flex items-center gap-1">
                  Read more <ArrowRight size={13} />
                </span>
              </article>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
