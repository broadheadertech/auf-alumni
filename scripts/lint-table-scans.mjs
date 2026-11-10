#!/usr/bin/env node
/**
 * lint-table-scans.mjs
 *
 * Flags unbounded reads of a Convex table — a `ctx.db.query("x")` that ends in
 * `.collect()` or `.unique()` without narrowing through `.withIndex` or
 * `.withSearchIndex` first.
 *
 * These are the reads whose cost grows with the table rather than with the
 * answer, and they are invisible in review: the code looks the same and the
 * tests pass either way. `/admin/directory` read two whole tables on every
 * request for months, and the only symptom was that it felt slow.
 *
 * Not every scan is wrong. Aggregate dashboards legitimately count whole
 * tables, reference tables are small by construction, and seeders and
 * migrations exist to walk everything. So this does not ban scans — it
 * requires that each one says why, which is the part that was missing:
 *
 *   // @full-scan-ok: <reason>
 *   const rows = await ctx.db.query("profiles").collect();
 *
 * or, for a module that is nothing but bulk work, once at the top of the file:
 *
 *   // @full-scan-file-ok: <reason>
 *
 * Bounded reads are not flagged. `.take(n)`, `.first()` and `.paginate()` stop
 * early, so their cost does not grow with the table even without an index.
 *
 * Matching lives in scripts/lib/convex-source.mjs, shared with the other
 * convex lints. The first version of this script had its own line-by-line
 * matcher and saw 67 of 308 call sites while reporting a clean run; that is
 * why there is now one matcher instead of three.
 */

import {
  convexFiles,
  readSource,
  maskComments,
  findTableQueries,
  hasMarkerAbove,
  assertAccountedFor,
} from "./lib/convex-source.mjs";

const LINE_OK = "// @full-scan-ok:";
const FILE_OK = "// @full-scan-file-ok:";

const violations = [];
let examined = 0;
let expected = 0;
let indexed = 0;
let bounded = 0;
let justified = 0;

for (const rel of convexFiles()) {
  const src = readSource(rel);
  const masked = maskComments(src);
  const lines = src.split("\n");
  const fileExempt = lines.slice(0, 40).some((l) => l.trim().startsWith(FILE_OK));

  // Independent, deliberately dumber count as a cross-check on the matcher:
  // any `.query("…")` at all, however the chain is written.
  expected += (masked.match(/\.query\(\s*"[A-Za-z_][A-Za-z0-9_]*"\s*\)/g) ?? []).length;

  for (const q of findTableQueries(src, masked)) {
    examined += 1;

    // The chain runs to the end of its statement. Stop at the next `;` or at
    // the next query in the same statement — a Promise.all array holds several
    // chains before the one semicolon that closes it.
    const semi = masked.indexOf(";", q.end);
    const nextQuery = masked.slice(q.end).search(/ctx\.db\s*\.\s*query\(/);
    const window = masked.slice(
      q.end,
      Math.min(
        semi === -1 ? masked.length : semi,
        nextQuery === -1 ? masked.length : q.end + nextQuery,
      ),
    );

    const firstOf = (...needles) => {
      let best = Infinity;
      for (const n of needles) {
        const at = window.indexOf(n);
        if (at !== -1 && at < best) best = at;
      }
      return best;
    };

    const narrowAt = firstOf(".withIndex", ".withSearchIndex");
    const unboundedAt = firstOf(".collect()", ".unique()");
    const boundedAt = firstOf(".take(", ".first()", ".paginate(");

    if (narrowAt < Math.min(unboundedAt, boundedAt)) {
      indexed += 1;
      continue;
    }
    if (boundedAt < unboundedAt) {
      bounded += 1;
      continue;
    }
    if (unboundedAt === Infinity) continue; // no terminator in this statement

    if (fileExempt || hasMarkerAbove(lines, q.line, LINE_OK)) {
      justified += 1;
      continue;
    }

    violations.push(
      `${rel}:${q.line}  unbounded read of "${q.table}" without an index or a reason`,
    );
  }
}

assertAccountedFor({
  label: "lint:scans",
  examined,
  expected,
  detail: "ctx.db.query() call sites",
});

if (violations.length > 0) {
  console.error(
    "Table-scan lint failed - an unbounded read must either use an index or say why it does not.",
  );
  console.error("");
  for (const v of violations) console.error("  " + v);
  console.error("");
  console.error("Fix: narrow the query with .withIndex(...), bound it with .take(n),");
  console.error(`or annotate the line above with \`${LINE_OK} <reason>\`.`);
  console.error(`A module that is entirely bulk work can carry \`${FILE_OK} <reason>\` at the top.`);
  process.exit(1);
}

console.log(
  `lint:scans OK - examined ${examined} of ${expected} query sites: ` +
    `${indexed} indexed, ${bounded} bounded, ${justified} scans justified, 0 unexplained.`,
);
