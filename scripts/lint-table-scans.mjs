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
 * Note on matching: the query chain is usually split across lines, as
 * `ctx.db\n  .query("x")\n  .withIndex(...)`, so this works over the whole file
 * rather than line by line — a per-line version of this check saw only 67 of
 * the 308 call sites and reported a clean run. Comments are masked out first so
 * that prose mentioning `.collect()` cannot be mistaken for code.
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

const LINE_OK = "// @full-scan-ok:";
const FILE_OK = "// @full-scan-file-ok:";

/**
 * Blank out comments, keeping every other byte at its original offset so line
 * numbers and the windows below stay accurate.
 */
function maskComments(src) {
  const out = src.split("");
  let i = 0;
  let inLine = false;
  let inBlock = false;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (!inLine && !inBlock && two === "//") {
      inLine = true;
    } else if (!inLine && !inBlock && two === "/*") {
      inBlock = true;
    }
    if (inLine && src[i] === "\n") {
      inLine = false;
    } else if (inBlock && two === "*/") {
      out[i] = " ";
      out[i + 1] = " ";
      i += 2;
      inBlock = false;
      continue;
    }
    if ((inLine || inBlock) && src[i] !== "\n") out[i] = " ";
    i += 1;
  }
  return out.join("");
}

const QUERY = /ctx\.db\s*\.\s*query\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g;

const violations = [];
let indexed = 0;
let bounded = 0;
let justified = 0;

for (const rel of files) {
  const src = readFileSync(join(root, rel), "utf8");
  const masked = maskComments(src);
  const lines = src.split("\n");
  const fileExempt = lines.slice(0, 40).some((l) => l.trim().startsWith(FILE_OK));

  QUERY.lastIndex = 0;
  let m;
  while ((m = QUERY.exec(masked)) !== null) {
    const table = m[1];
    const end = m.index + m[0].length;

    // The chain runs to the end of its statement. Stop at the next `;` or at
    // the next query in the same statement — a Promise.all array holds several
    // chains before the one semicolon that closes it.
    const semi = masked.indexOf(";", end);
    const nextQuery = masked.slice(end).search(/ctx\.db\s*\.\s*query\(/);
    const stops = [
      semi === -1 ? masked.length : semi,
      nextQuery === -1 ? masked.length : end + nextQuery,
    ];
    const window = masked.slice(end, Math.min(...stops));

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

    if (fileExempt) {
      justified += 1;
      continue;
    }

    const line = src.slice(0, m.index).split("\n").length;
    // Accept the annotation anywhere in the comment block directly above.
    let j = line - 2;
    let ok = false;
    while (j >= 0) {
      const t = (lines[j] ?? "").trim();
      if (t.startsWith(LINE_OK)) {
        ok = true;
        break;
      }
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t === "") {
        j -= 1;
        continue;
      }
      break;
    }
    if (ok) {
      justified += 1;
      continue;
    }
    violations.push(
      `${rel}:${line}  unbounded read of "${table}" without an index or a reason`,
    );
  }
}

if (violations.length > 0) {
  console.error(
    "Table-scan lint failed — an unbounded read must either use an index or say why it does not.",
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
  `lint:scans OK — ${indexed} indexed, ${bounded} bounded, ${justified} scans justified, 0 unexplained.`,
);
