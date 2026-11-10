#!/usr/bin/env node
/**
 * lint-admin-mutations.mjs (Story 1.4)
 *
 * Admin mutations must call both `requireRole(` and `withAuditLog(`, unless
 * annotated with `// @no-audit-required: <reason>`.
 *
 * Two rules, because "admin mutation" has two useful definitions:
 *
 *   A. Every exported mutation in a known admin module needs both. This is the
 *      strict rule: it catches an admin mutation that forgot requireRole
 *      altogether, which rule B cannot see by construction.
 *
 *   B. Anywhere in convex/, a mutation that calls requireRole must also call
 *      withAuditLog. This rule is self-identifying -- it needs no list of
 *      files, so a new admin surface cannot escape it.
 *
 * Rule B exists because this lint used to be rule A alone, over a hardcoded
 * list of eleven files, and skipped anything missing from that list in
 * silence. 23 role-guarded mutations had grown up outside the list, nine of
 * them with no audit log, and the lint reported "scanned 11 files" throughout.
 * A stale entry in ADMIN_MODULES is now a hard error rather than a skip, for
 * the same reason.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  repoRoot,
  convexFiles,
  readSource,
  maskComments,
  hasMarkerAbove,
  lineAt,
} from "./lib/convex-source.mjs";

/** Modules where EVERY exported mutation must be audited and role-guarded. */
const ADMIN_MODULES = [
  "convex/admin.ts",
  // convex/moderation.ts was listed here and has never existed. Moderation
  // lives in reports.ts, jobs.ts and accountStatus.ts, which rule B covers
  // because those mutations are role-guarded.
  "convex/verification.ts",
  "convex/taxonomy.ts",
  "convex/lookups.ts",
  "convex/siteContent.ts",
  "convex/articles.ts",
  "convex/adminEmployers.ts",
  "convex/accountStatus.ts",
  "convex/adminAlumni.ts",
  "convex/enquiries.ts",
];

const ANNOTATION = "// @no-audit-required:";
const MUTATION =
  /export\s+const\s+(\w+)\s*=\s*(mutation|internalMutation)\s*\(/g;

const stale = ADMIN_MODULES.filter((rel) => !existsSync(join(repoRoot, rel)));
if (stale.length > 0) {
  console.error("Admin-mutation lint failed - ADMIN_MODULES lists files that no longer exist:");
  for (const s of stale) console.error("  " + s);
  console.error("");
  console.error("Silently skipping them is how this lint missed 23 mutations before.");
  console.error("Remove the entry, or correct the path.");
  process.exit(1);
}

const violations = [];
let examined = 0;
let roleGuarded = 0;
let annotated = 0;

for (const rel of convexFiles()) {
  const src = readSource(rel);
  const masked = maskComments(src);
  const lines = src.split("\n");
  const isAdminModule = ADMIN_MODULES.includes(rel);

  MUTATION.lastIndex = 0;
  let m;
  while ((m = MUTATION.exec(masked)) !== null) {
    const name = m[1];
    const line = lineAt(src, m.index);

    // Body extent by brace matching from the declaration.
    let depth = 0;
    let started = false;
    let end = masked.length;
    for (let k = m.index; k < masked.length; k += 1) {
      const ch = masked[k];
      if (ch === "{") {
        depth += 1;
        started = true;
      } else if (ch === "}") {
        depth -= 1;
        if (started && depth === 0) {
          end = k + 1;
          break;
        }
      }
    }
    const body = masked.slice(m.index, end);

    // Matched without a trailing paren on purpose: a handler that needs to
    // pin withAuditLog's Args generic writes `withAuditLog<{...}>(`, and
    // requiring `withAuditLog(` reported a correctly-wrapped mutation as
    // unaudited. Comments are already masked out, and neither name appears in
    // a mutation body except as a call.
    const hasRole = body.includes("requireRole");
    const hasAudit = body.includes("withAuditLog");
    if (hasRole) roleGuarded += 1;

    // Rule A for admin modules, rule B everywhere else.
    const inScope = isAdminModule || hasRole;
    if (!inScope) continue;
    examined += 1;

    if (hasMarkerAbove(lines, line, ANNOTATION)) {
      annotated += 1;
      continue;
    }

    const missing = [];
    if (!hasAudit) missing.push("withAuditLog");
    if (isAdminModule && !hasRole) missing.push("requireRole");
    if (missing.length > 0) {
      const why = isAdminModule ? "admin module" : "calls requireRole";
      violations.push(
        `${rel}:${line}  mutation \`${name}\` (${why}) missing: ${missing.join(", ")}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(
    "Admin-mutation lint failed - a privileged mutation must be role-guarded and audited.",
  );
  console.error("");
  for (const v of violations) console.error("  " + v);
  console.error("");
  console.error("Fix: wrap the handler in `withAuditLog(...)` and call `requireRole(ctx, [...])` first,");
  console.error(`or annotate the line above with \`${ANNOTATION} <reason>\`.`);
  process.exit(1);
}

console.log(
  `lint:admin OK - examined ${examined} privileged mutations ` +
    `(${roleGuarded} role-guarded) across ${convexFiles().length} files, ` +
    `${annotated} annotated, 0 unguarded.`,
);
