#!/usr/bin/env node
/**
 * lint-admin-mutations.mjs (Story 1.4)
 *
 * Scans web/convex/{admin,moderation,verification}.ts (when they exist) for
 * exported mutations and asserts each contains both `withAuditLog(` and
 * `requireRole(` calls, unless explicitly annotated with
 * `// @no-audit-required: <reason>`.
 *
 * Exits with code 1 if any admin mutation lacks the required guardrails.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const filesToScan = [
  "convex/admin.ts",
  "convex/moderation.ts",
  "convex/verification.ts",
];

const violations = [];

for (const rel of filesToScan) {
  const abs = join(root, rel);
  if (!existsSync(abs)) continue;
  const src = readFileSync(abs, "utf8");
  const lines = src.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Look for `export const X = mutation({` or `export const X = internalMutation({`
    const exportMatch = line.match(
      /export\s+const\s+(\w+)\s*=\s*(mutation|internalMutation)\s*\(\s*\{?/,
    );
    if (!exportMatch) {
      i++;
      continue;
    }
    const name = exportMatch[1];

    // Find the closing of this mutation block by counting braces
    let depth = 0;
    let started = false;
    let endLine = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") depth--;
      }
      if (started && depth === 0) {
        endLine = j;
        break;
      }
    }
    const block = lines.slice(i, endLine + 1).join("\n");

    const hasAudit = block.includes("withAuditLog(");
    const hasRole = block.includes("requireRole(");
    const annotated =
      i > 0 && lines[i - 1].trim().startsWith("// @no-audit-required:");

    if (!annotated && (!hasAudit || !hasRole)) {
      const missing = [];
      if (!hasAudit) missing.push("withAuditLog");
      if (!hasRole) missing.push("requireRole");
      violations.push(
        `${rel}:${i + 1}  mutation \`${name}\` missing: ${missing.join(", ")}`,
      );
    }
    i = endLine + 1;
  }
}

if (violations.length > 0) {
  console.error("Admin-mutation lint failed — admin/moderation/verification mutations must use withAuditLog + requireRole.");
  console.error("");
  for (const v of violations) console.error("  " + v);
  console.error("");
  console.error("Fix: wrap the handler in `withAuditLog(...)` and call `requireRole(ctx, [...])` first,");
  console.error("or annotate the line above with `// @no-audit-required: <reason>`.");
  process.exit(1);
}

console.log(`lint:admin OK — scanned ${filesToScan.length} files.`);
