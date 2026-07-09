import { redirect } from "next/navigation";

/**
 * Employer onboarding moved into an "Add employer" modal on the roster
 * (/admin/employers). This stub redirects any lingering links there.
 */
export default function EmployerOnboardRedirect() {
  redirect("/admin/employers");
}
