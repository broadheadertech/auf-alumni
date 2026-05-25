#!/usr/bin/env node
/**
 * check-bundle-budget.mjs (Story 1.5)
 *
 * Runs after `next build`. Walks `.next/app-build-manifest.json` and the
 * generated chunk files, then enforces the per-route gzipped JS budgets
 * defined in NFR7:
 *   - 150 KB gzipped for marketing/auth routes
 *   - 250 KB gzipped for the directory route
 *
 * Exits 1 if any route exceeds its budget; prints a delta table either way.
 */

import { gzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const next = join(webRoot, ".next");

if (!existsSync(next)) {
  console.error("No .next directory found. Run `next build` first.");
  process.exit(1);
}

const manifestPath = join(next, "app-build-manifest.json");
if (!existsSync(manifestPath)) {
  console.error("No app-build-manifest.json — Next.js build may have failed.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pages = manifest.pages ?? {};

// NFR7 budgets in bytes (gzipped)
const BUDGETS = [
  { match: /^\/page$/, budget: 150 * 1024, label: "marketing /" },
  { match: /^\/\(marketing\)\/page$/, budget: 150 * 1024, label: "marketing /" },
  { match: /^\/\(auth\)\/.+/, budget: 150 * 1024, label: "(auth) route" },
  { match: /^\/\(alumni\)\/directory\/page$/, budget: 250 * 1024, label: "(alumni)/directory" },
  // catch-all for other (alumni) routes — still tight
  { match: /^\/\(alumni\)\/.+/, budget: 200 * 1024, label: "(alumni) route" },
  { match: /^\/\(employer\)\/.+/, budget: 200 * 1024, label: "(employer) route" },
  { match: /^\/\(admin\)\/.+/, budget: 250 * 1024, label: "(admin) route" },
];

function gzippedSize(filePath) {
  try {
    const buf = readFileSync(filePath);
    return gzipSync(buf).length;
  } catch {
    return 0;
  }
}

let failed = false;
const rows = [];

for (const [routeKey, chunks] of Object.entries(pages)) {
  let total = 0;
  for (const chunk of chunks) {
    if (!chunk.endsWith(".js")) continue;
    const p = join(next, chunk);
    if (existsSync(p)) total += gzippedSize(p);
  }
  const budgetEntry = BUDGETS.find((b) => b.match.test(routeKey));
  const budget = budgetEntry?.budget ?? null;
  const overBudget = budget != null && total > budget;
  if (overBudget) failed = true;
  rows.push({ route: routeKey, gz: total, budget, overBudget });
}

const fmt = (n) =>
  n == null ? "—" : `${(n / 1024).toFixed(1)} KB`;

console.log("Bundle budget report (gzipped JS):");
console.log("");
console.log(`  ${"Route".padEnd(50)} ${"gz".padEnd(12)} ${"budget".padEnd(12)} status`);
for (const r of rows) {
  const status = r.budget == null ? "—" : r.overBudget ? "OVER" : "ok";
  console.log(
    `  ${r.route.padEnd(50)} ${fmt(r.gz).padEnd(12)} ${fmt(r.budget).padEnd(12)} ${status}`,
  );
}
console.log("");

if (failed) {
  console.error("Bundle budget exceeded on one or more routes. See NFR7.");
  process.exit(1);
}
console.log("All routes within budget.");
