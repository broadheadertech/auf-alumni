import { redirect } from "next/navigation";

/**
 * Job moderation folded into the full Job postings list (/admin/jobs), where
 * pending posts are approved/rejected inline. This stub redirects old links.
 */
export default function JobModerationRedirect() {
  redirect("/admin/jobs");
}
