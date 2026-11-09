#!/usr/bin/env node
/**
 * lint-privacy-usage.mjs (Story 1.3)
 *
 * Scans web/convex/**\/*.ts for reads of the `profiles` table and flags any
 * file that does not subsequently call `applyPrivacy` OR carry a
 * `// @no-privacy-required: <reason>` annotation above the offending line.
 *
 * A "read" is either a direct `ctx.db.query("profiles")` or a call to one of
 * the shared indexed readers in convex/helpers/indexedReads.ts, which return
 * the same raw documents. Without the second form, moving a query behind a
 * helper would silently drop the file out of this check — the helper is a
 * performance change, not a privacy exemption.
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

/**
 * Call sites that hand back raw `profiles` documents. Keep in sync with the
 * exports of convex/helpers/indexedReads.ts that return profile rows.
 */
const PROFILE_READS = ['ctx.db.query("profiles")', "verifiedProfiles(ctx)"];

/** The helper's own definition is where the annotation legitimately lives. */
const HELPER_MODULE = "convex/helpers/indexedReads.ts";

const isProfileRead = (line) => PROFILE_READS.some((frag) => line.includes(frag));

const violations = [];

for (const rel of files) {
  const abs = join(root, rel);
  const src = readFileSync(abs, "utf8");
  const lines = src.split("\n");
  // Importing the helper is not itself a read; only calling it is.
  const queriesProfiles = lines.some(
    (line) => isProfileRead(line) && !line.trimStart().startsWith("import"),
  );
  if (!queriesProfiles) continue;

  const hasApplyPrivacy = src.includes("applyPrivacy(");
  if (hasApplyPrivacy) continue;

  // Check each `ctx.db.query("profiles")` line for an inline override
  let unsafeFound = false;
  lines.forEach((line, i) => {
    if (!isProfileRead(line)) return;
    if (line.trimStart().startsWith("import")) return;
    if (rel.replaceAll("\\", "/") === HELPER_MODULE) return;
    const prev = lines[i - 1] ?? "";
    if (prev.trim().startsWith("// @no-privacy-required:")) return;
    violations.push(`${rel}:${i + 1}  profiles read without applyPrivacy or @no-privacy-required annotation`);
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

console.log(
  `lint:privacy OK — scanned ${files.length} files for ${PROFILE_READS.length} read forms, no violations.`,
);
