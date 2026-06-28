import { redirect } from "next/navigation";

/**
 * The alumni directory moved to the admin surface (/admin/directory). The full
 * verified-alumni roster is private to alumni, so the alumnus-facing app no
 * longer exposes a directory.
 *
 * This stub stays so any lingering `/directory` links (e.g. older transactional
 * emails) resolve gracefully instead of 404-ing — alumni are bounced to their
 * feed. Admins reach the directory from the admin navigation.
 */
export default function DirectoryRedirect() {
  redirect("/feed");
}
