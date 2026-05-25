#!/usr/bin/env node
/**
 * lint-privacy-usage.mjs (Story 1.3)
 *
 * Scans web/convex/**\/*.ts for direct `ctx.db.query("profiles")` calls and
 * flags any file that does not subsequently call `applyPrivacy` OR carry a
 * `// @no-privacy-required: <reason>` annotation above the offending line.
 *
 * Exits with code 1 if any unsafe usage is found.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const files = globSync("convex/**/*.ts", {
  cwd: root,
  ignore: ["convex/_generated/**", "convex/tests/**"],
});

const violations = [];

for (const rel of files) {
  const abs = join(root, rel);
  const src = readFileSync(abs, "utf8");
  const lines = src.split("\n");
  const queriesProfiles = src.includes('ctx.db.query("profiles")');
  if (!queriesProfiles) continue;

  const hasApplyPrivacy = src.includes("applyPrivacy(");
  if (hasApplyPrivacy) continue;

  // Check each `ctx.db.query("profiles")` line for an inline override
  let unsafeFound = false;
  lines.forEach((line, i) => {
    if (!line.includes('ctx.db.query("profiles")')) return;
    const prev = lines[i - 1] ?? "";
    if (prev.trim().startsWith("// @no-privacy-required:")) return;
    violations.push(`${rel}:${i + 1}  ctx.db.query("profiles") without applyPrivacy or @no-privacy-required annotation`);
    unsafeFound = true;
  });

  if (!unsafeFound) continue;
}

if (violations.length > 0) {
  console.error("Privacy lint failed — every ctx.db.query(\"profiles\") must apply the privacy helper.");
  console.error("");
  for (const v of violations) console.error("  " + v);
  console.error("");
  console.error("Fix: import { applyPrivacy } from \"./helpers/privacy\"; and filter results,");
  console.error("or annotate the line above with `// @no-privacy-required: <reason>`.");
  process.exit(1);
}

console.log(`lint:privacy OK — scanned ${files.length} files, no violations.`);
