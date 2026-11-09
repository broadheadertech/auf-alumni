/** Formatting helpers for CMS articles (newsroom). */

/** "September 14, 2026" in Manila time, so server and client agree. */
export function formatArticleDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

/** Split a plain-text body into paragraphs on blank lines. */
export function toParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
