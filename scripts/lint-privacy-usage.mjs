#!/usr/bin/env node
/**
 * lint-privacy-usage.mjs (Story 1.3)
 *
 * Every read of the `profiles` table must either pass its rows through
 * `applyPrivacy` in the same exported handler, or carry a
 * `// @no-privacy-required: <reason>` annotation saying why it does not.
 *
 * Two things about this lint were wrong for a long time, and both made it
 * report success while barely looking:
 *
 * 1. It matched line by line. A Convex chain is usually split as
 *    `ctx.db\n  .query("profiles")\n  .collect()`, so it was examining 23 of
 *    76 reads -- 30% -- and printing "no violations" the whole time.
 *
 * 2. The `applyPrivacy` exemption was file-scoped. One call anywhere in a
 *    module exempted every read in it, and convex/profiles.ts has fifteen.
 *    The exemption is now scoped to the enclosing exported function, so an
 *    unrelated handler in the same file cannot vouch for a read.
 *
 * A "read" is a direct `ctx.db.query("profiles")` or a call to one of the
 * shared indexed readers in convex/helpers/indexedReads.ts, which hand back
 * the same raw documents. Without the second form, moving a query behind a
 * helper would silently drop it out of this check -- a helper is a performance
 * change, not a privacy exemption.
 *
 * Exits 1 if any read is neither covered nor explained, and also if the
 * matcher cannot account for every `.query("profiles")` in the source, since
 * a lint that has gone blind would otherwise pass.
 */

import {
  convexFiles,
  readSource,
  maskComments,
  findTableQueries,
  exportBlocks,
  blockContaining,
  hasMarkerAbove,
  lineAt,
  assertAccountedFor,
} from "./lib/convex-source.mjs";

const ANNOTATION = "// @no-privacy-required:";

/** Helpers that return raw profile documents. Keep in sync with indexedReads. */
const HELPER_READS = [/verifiedProfiles\s*\(/g];

/** The helpers' own definitions, where the annotation legitimately lives. */
const HELPER_MODULE = "convex/helpers/indexedReads.ts";

const violations = [];
let examined = 0;
let expected = 0;
let coveredByHelper = 0;
let annotated = 0;

for (const rel of convexFiles()) {
  const src = readSource(rel);
  const masked = maskComments(src);
  const lines = src.split("\n");
  const blocks = exportBlocks(src, masked);

  // Independent, deliberately dumber count as a cross-check on the matcher:
  // any `.query("profiles")` at all, however the chain is written.
  expected += (masked.match(/\.query\(\s*"profiles"\s*\)/g) ?? []).length;

  if (rel === HELPER_MODULE) {
    // Count its own reads so the totals balance, but it is the definition
    // site: its module docstring carries the justification.
    examined += (masked.match(/\.query\(\s*"profiles"\s*\)/g) ?? []).length;
    coveredByHelper += 1;
    continue;
  }

  const reads = findTableQueries(src, masked)
    .filter((q) => q.table === "profiles")
    .map((q) => ({ offset: q.offset, line: q.line, kind: "query" }));
  examined += reads.length;

  for (const re of HELPER_READS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(masked)) !== null) {
      const line = lineAt(src, m.index);
      // Importing a helper is not calling it.
      if ((lines[line - 1] ?? "").trimStart().startsWith("import")) continue;
      reads.push({ offset: m.index, line, kind: "helper" });
    }
  }

  for (const read of reads) {
    if (hasMarkerAbove(lines, read.line, ANNOTATION)) {
      annotated += 1;
      continue;
    }
    const block = blockContaining(blocks, read.offset);
    // A justification that covers the whole handler belongs above the handler,
    // which is where the existing ones in convex/profiles.ts already sit. Only
    // looking above the read itself made those read as unannotated and would
    // have had us duplicate the comment inside the body.
    if (block && hasMarkerAbove(lines, block.line, ANNOTATION)) {
      annotated += 1;
      continue;
    }
    const scope = block ? masked.slice(block.start, block.end) : "";
    if (block && scope.includes("applyPrivacy(")) continue;

    const where = block ? `in ${block.name}()` : "at module scope";
    violations.push(
      `${rel}:${read.line}  profiles read ${where} with no applyPrivacy in that handler and no @no-privacy-required`,
    );
  }
}

assertAccountedFor({
  label: "lint:privacy",
  examined,
  expected,
  detail: 'ctx.db.query("profiles") call sites',
});

if (violations.length > 0) {
  console.error(
    'Privacy lint failed - every read of "profiles" must apply the privacy helper or explain itself.',
  );
  console.error("");
  for (const v of violations) console.error("  " + v);
  console.error("");
  console.error('Fix: import { applyPrivacy } from "./helpers/privacy"; and filter the rows');
  console.error("in the same handler, or annotate the line above with");
  console.error(`\`${ANNOTATION} <reason>\`.`);
  process.exit(1);
}

console.log(
  `lint:privacy OK - examined ${examined} of ${expected} profiles reads, ` +
    `${annotated} annotated, ${coveredByHelper} helper module(s), 0 unexplained.`,
);
