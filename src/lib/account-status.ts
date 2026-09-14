/**
 * Account lifecycle display helpers. State lives in Convex (see
 * convex/accountStatus.ts): alumni on `users`, employers on `employerOrgs`,
 * via `suspendedAt` / `suspendedReason` / `suspendedKind`.
 */

export type AccountStatusKind = "deactivated" | "rejected" | "suspended";

export type AccountStatus = {
  kind: AccountStatusKind;
  at: number; // ms
  reason: string;
} | null;

export const ACCOUNT_STATUS_LABEL: Record<AccountStatusKind, string> = {
  deactivated: "Deactivated",
  rejected: "Rejected",
  suspended: "Suspended",
};

export const ACCOUNT_STATUS_TONE: Record<AccountStatusKind, string> = {
  deactivated: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  rejected: "bg-destructive/10 text-destructive",
  suspended: "bg-destructive/10 text-destructive",
};
