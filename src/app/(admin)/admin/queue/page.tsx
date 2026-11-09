import { redirect } from "next/navigation";

/**
 * Legacy verification queue — superseded by /admin/alumni/approvals.
 *
 * Two approval queues existed side by side, backed by different queries
 * (api.admin.verificationQueue here, api.adminData.pendingApprovals there), so
 * they could disagree about what was waiting. Only the Approvals screen is in
 * the admin navigation, and only it is documented in the guide.
 *
 * This stub stays so any bookmark or emailed link still lands somewhere useful
 * instead of 404-ing. Same pattern as the /directory stub.
 */
export default function AdminQueueRedirect() {
  redirect("/admin/alumni/approvals");
}
