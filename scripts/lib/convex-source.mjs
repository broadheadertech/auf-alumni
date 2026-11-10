/**
 * Shared source matching for the convex lint scripts.
 *
 * This file exists because three of the four lints had each written their own
 * matcher, and two of them were wrong in the same way: they matched line by
 * line, while a Convex chain is almost always split across lines as
 *
 *   const rows = await ctx.db
 *     .query("profiles")
 *     .withIndex("by_verified", (q) => q.gt("verifiedAt", 0))
 *     .collect();
 *
 * A per-line matcher never sees that at all. lint:privacy was looking at 23 of
 * 76 profiles reads and reporting a clean run; lint:scans was at 67 of 308.
 * Both reported success the whole time, which is the worst way for a guard to
 * fail: it is indistinguishable from working.
 *
 * So: one matcher, operating on the whole file, with comments masked out so
 * prose about `.collect()` is not mistaken for a call to it.
 */

import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Every convex source file a lint should consider. Never a hardcoded list. */
export function convexFiles() {
  return globSync("convex/**/*.ts", {
    cwd: repoRoot,
    ignore: ["convex/_generated/**", "convex/tests/**"],
  }).map((p) => p.replaceAll("\\", "/"));
}

export function readSource(rel) {
  return readFileSync(join(repoRoot, rel), "utf8");
}

/**
 * Blank out comments, keeping every other byte at its original offset so line
 * numbers and substring windows stay accurate.
 */
export function maskComments(src) {
  const out = src.split("");
  let i = 0;
  let inLine = false;
  let inBlock = false;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (!inLine && !inBlock && two === "//") inLine = true;
    else if (!inLine && !inBlock && two === "/*") inBlock = true;
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

/** 1-based line number of a character offset. */
export function lineAt(src, offset) {
  return src.slice(0, offset).split("\n").length;
}

/**
 * Is `marker` somewhere in the contiguous comment block directly above `line`
 * (1-based)? The walk stops at the first line that is not a comment or blank,
 * so a marker can never be claimed across intervening code.
 *
 * Checking only the single preceding line, as this used to, made the contract
 * brittle enough that the codebase grew comments telling the next person where
 * the annotation had to sit.
 */
export function hasMarkerAbove(lines, line, marker) {
  for (let j = line - 2; j >= 0; j -= 1) {
    const t = (lines[j] ?? "").trim();
    if (t.startsWith(marker)) return true;
    if (t === "" || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    return false;
  }
  return false;
}

/**
 * Every `ctx.db.query("<table>")` in a file, as {table, offset, line, end}.
 * Multi-line chains included; occurrences inside comments excluded.
 */
export function findTableQueries(src, masked = maskComments(src)) {
  const re = /ctx\.db\s*\.\s*query\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g;
  const found = [];
  let m;
  while ((m = re.exec(masked)) !== null) {
    found.push({
      table: m[1],
      offset: m.index,
      end: m.index + m[0].length,
      line: lineAt(src, m.index),
    });
  }
  return found;
}

/**
 * The exported Convex function each offset sits inside, so an exemption can be
 * scoped to one handler instead of to a whole module.
 *
 * Boundaries are `export const <name> = <kind>(`, which is how every Convex
 * function in this codebase is declared; a block runs to the next such export
 * or to end of file.
 */
export function exportBlocks(src, masked = maskComments(src)) {
  const re =
    /export\s+const\s+(\w+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction|httpAction)\s*\(/g;
  const starts = [];
  let m;
  while ((m = re.exec(masked)) !== null) {
    starts.push({ name: m[1], kind: m[2], start: m.index });
  }
  return starts.map((s, i) => ({
    ...s,
    end: i + 1 < starts.length ? starts[i + 1].start : src.length,
    line: lineAt(src, s.start),
  }));
}

export function blockContaining(blocks, offset) {
  return blocks.find((b) => offset >= b.start && offset < b.end) ?? null;
}

/**
 * Print a coverage line and fail the lint if it cannot account for every
 * occurrence it ought to have examined.
 *
 * This is the guard against the failure above. A lint that says "scanned 63
 * files" reports exactly the same thing whether it examined every call site or
 * none of them; one that says "examined 76 of 76" cannot quietly go blind.
 */
export function assertAccountedFor({ label, examined, expected, detail }) {
  if (examined < expected) {
    console.error(
      `${label} is not seeing everything: examined ${examined} of ${expected} ${detail}.`,
    );
    console.error(
      "A lint that cannot see its subject will report success regardless, so this is a failure.",
    );
    process.exit(1);
  }
}
