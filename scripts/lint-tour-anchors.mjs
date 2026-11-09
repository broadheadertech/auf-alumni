#!/usr/bin/env node
/**
 * lint-tour-anchors.mjs
 *
 * Every `target:` in src/lib/guide/tours.ts must have a matching
 * `data-tour="..."` somewhere in src/.
 *
 * The tour engine skips a step whose target is missing, which is the right
 * runtime behaviour — a tour should survive a control hidden by role or by an
 * empty state rather than pointing at nothing. But it also means a typo, or a
 * step written before its anchor was added, degrades in silence: the tour just
 * runs short and nobody notices. That is exactly what happened on
 * /employer/applicants, where a four-step tour was quietly running one step.
 *
 * This turns that silence into a failure.
 *
 *   node scripts/lint-tour-anchors.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toursFile = join(root, "src/lib/guide/tours.ts");

const tours = readFileSync(toursFile, "utf8");
const declared = new Map();
for (const m of tours.matchAll(/target:\s*"([a-z0-9-]+)"/g)) {
  declared.set(m[1], (declared.get(m[1]) ?? 0) + 1);
}

/** Every data-tour attribute actually present in the source. */
const present = new Set();
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (![".tsx", ".ts"].includes(extname(full))) continue;
    if (full === toursFile) continue;
    const src = readFileSync(full, "utf8");
    for (const m of src.matchAll(/data-tour=["{]?["']?([a-z0-9-]+)["']?/g)) {
      present.add(m[1]);
    }
  }
}
walk(join(root, "src"));

const missing = [...declared.keys()].filter((t) => !present.has(t)).sort();
const unused = [...present]
  .filter((t) => !declared.has(t) && t !== "dataTour")
  .sort();

if (missing.length > 0) {
  console.error(
    "\nTour lint failed — these targets have no data-tour anchor in src/:\n",
  );
  for (const t of missing) {
    console.error(`  ${t}  (used by ${declared.get(t)} step(s))`);
  }
  console.error(
    "\nAdd data-tour=\"<name>\" to the element the step describes, or drop the\n" +
      "`target` so the step renders centred instead.\n",
  );
  process.exit(1);
}

console.log(
  `lint:tours OK — ${declared.size} targets, all anchored.` +
    (unused.length ? ` (${unused.length} anchor(s) not yet used by a step: ${unused.join(", ")})` : ""),
);
