import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The lint scripts had no tests, and that is the whole reason this file exists.
 *
 * lint:privacy was examining 23 of 76 profiles reads and printing "no
 * violations"; lint:scans was at 67 of 308 and doing the same; lint:admin was
 * skipping a non-existent entry in its file list in silence while 23
 * role-guarded mutations grew up outside it. Each failure looked exactly like
 * success, which is the only kind of guard failure that matters -- a guard
 * that goes red gets fixed, and a guard that goes green while blind does not.
 *
 * The method here is to inject a file containing a known violation, assert the
 * lint fails and names it, then inject the fixed version and assert it passes.
 * Every fixture writes its query as a MULTI-LINE chain:
 *
 *   await ctx.db
 *     .query("profiles")
 *     .collect()
 *
 * because that is the form all three line-based matchers could not see. A
 * fixture written on one line would have passed against the broken lints and
 * taught us nothing.
 *
 * The fixture is written into the real convex/ directory rather than a
 * temporary root, so each lint runs exactly as CI runs it -- same globs, same
 * module list, same resolution.
 */

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..", "..");
const FIXTURE = resolve(webRoot, "convex", "__lint_fixture__.ts");

function runLint(script: string): { ok: boolean; output: string } {
  try {
    const out = execFileSync("node", [resolve(webRoot, "scripts", script)], {
      cwd: webRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: out };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

function withFixture(source: string, script: string) {
  writeFileSync(FIXTURE, source, "utf8");
  return runLint(script);
}

afterEach(() => {
  if (existsSync(FIXTURE)) rmSync(FIXTURE);
});

describe("the lints pass on a clean tree", () => {
  it("all four are green with no fixture present", () => {
    for (const script of [
      "lint-privacy-usage.mjs",
      "lint-admin-mutations.mjs",
      "lint-table-scans.mjs",
      "lint-tour-anchors.mjs",
    ]) {
      const { ok, output } = runLint(script);
      expect(ok, `${script} should pass on a clean tree:\n${output}`).toBe(true);
    }
  });
});

describe("lint:privacy", () => {
  const read = `
import { query } from "./_generated/server";
export const leaky = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("profiles")
      .collect();
    return rows;
  },
});
`;

  it("catches an unguarded profiles read written as a multi-line chain", () => {
    const { ok, output } = withFixture(read, "lint-privacy-usage.mjs");
    expect(ok).toBe(false);
    expect(output).toContain("__lint_fixture__.ts");
  });

  it("accepts it once annotated", () => {
    const annotated = read.replace(
      "    const rows = await ctx.db",
      "    // @no-privacy-required: fixture.\n    const rows = await ctx.db",
    );
    const { ok, output } = withFixture(annotated, "lint-privacy-usage.mjs");
    expect(ok, output).toBe(true);
  });

  it("accepts it when the handler applies privacy", () => {
    const guarded = read
      .replace(
        'import { query } from "./_generated/server";',
        'import { query } from "./_generated/server";\nimport { applyPrivacy } from "./helpers/privacy";',
      )
      .replace("    return rows;", "    return rows.map((r) => applyPrivacy(r, { kind: \"stranger\" }));");
    const { ok, output } = withFixture(guarded, "lint-privacy-usage.mjs");
    expect(ok, output).toBe(true);
  });

  it("does not let one handler's applyPrivacy vouch for another's read", () => {
    // This is the file-scoped exemption that used to let fifteen reads in
    // convex/profiles.ts ride on a single call elsewhere in the module.
    const twoHandlers = `
import { query } from "./_generated/server";
import { applyPrivacy } from "./helpers/privacy";
export const safe = query({
  args: {},
  handler: async (ctx) => {
    const one = await ctx.db
      .query("profiles")
      .first();
    return one ? applyPrivacy(one, { kind: "stranger" }) : null;
  },
});
export const unsafe = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("profiles")
      .collect();
  },
});
`;
    const { ok, output } = withFixture(twoHandlers, "lint-privacy-usage.mjs");
    expect(ok).toBe(false);
    expect(output).toContain("unsafe");
  });

  it("reports a denominator it can actually check", () => {
    const { output } = runLint("lint-privacy-usage.mjs");
    // "examined N of N" is the assertion that the matcher is not blind.
    const m = output.match(/examined (\d+) of (\d+)/);
    expect(m, `no coverage line in: ${output}`).not.toBeNull();
    expect(Number(m![1])).toBe(Number(m![2]));
    expect(Number(m![1])).toBeGreaterThan(40);
  });
});

describe("lint:admin", () => {
  it("catches a role-guarded mutation with no audit log, in any module", () => {
    // Rule B: this file is in no admin list, which is exactly how 23
    // mutations escaped before.
    const source = `
import { mutation } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
export const privileged = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["super-admin"]);
    return null;
  },
});
`;
    const { ok, output } = withFixture(source, "lint-admin-mutations.mjs");
    expect(ok).toBe(false);
    expect(output).toContain("privileged");
    expect(output).toContain("withAuditLog");
  });

  it("accepts it once wrapped", () => {
    const source = `
import { mutation } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";
export const privileged = mutation({
  args: {},
  handler: withAuditLog(async (ctx) => {
    await requireRole(ctx, ["super-admin"]);
    return { action: "fixture", target: { type: "none", id: "x" } };
  }),
});
`;
    const { ok, output } = withFixture(source, "lint-admin-mutations.mjs");
    expect(ok, output).toBe(true);
  });

  it("leaves unprivileged mutations alone", () => {
    const source = `
import { mutation } from "./_generated/server";
export const ordinary = mutation({
  args: {},
  handler: async () => null,
});
`;
    const { ok, output } = withFixture(source, "lint-admin-mutations.mjs");
    expect(ok, output).toBe(true);
  });
});

describe("lint:scans", () => {
  const scan = `
import { query } from "./_generated/server";
export const wide = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("jobs")
      .collect();
    return rows.length;
  },
});
`;

  it("catches an unbounded read written as a multi-line chain", () => {
    const { ok, output } = withFixture(scan, "lint-table-scans.mjs");
    expect(ok).toBe(false);
    expect(output).toContain("__lint_fixture__.ts");
  });

  it("accepts an indexed read", () => {
    const indexed = scan.replace(
      '      .query("jobs")',
      '      .query("jobs")\n      .withIndex("by_published")',
    );
    const { ok, output } = withFixture(indexed, "lint-table-scans.mjs");
    expect(ok, output).toBe(true);
  });

  it("accepts a bounded read", () => {
    const bounded = scan.replace("      .collect();", "      .take(10);");
    const { ok, output } = withFixture(bounded, "lint-table-scans.mjs");
    expect(ok, output).toBe(true);
  });

  it("accepts an annotated scan", () => {
    const annotated = scan.replace(
      "    const rows = await ctx.db",
      "    // @full-scan-ok: fixture.\n    const rows = await ctx.db",
    );
    const { ok, output } = withFixture(annotated, "lint-table-scans.mjs");
    expect(ok, output).toBe(true);
  });

  it("reports a denominator it can actually check", () => {
    const { output } = runLint("lint-table-scans.mjs");
    const m = output.match(/examined (\d+) of (\d+)/);
    expect(m, `no coverage line in: ${output}`).not.toBeNull();
    // If the matcher ever regresses to the line-based form, examined drops far
    // below expected, assertAccountedFor exits 1, and the clean-tree test above
    // goes red. Verified by deliberately reverting the matcher: both lints
    // reported "not seeing everything" (10 of 62, 62 of 303) instead of OK.
    expect(Number(m![1])).toBe(Number(m![2]));
    expect(Number(m![1])).toBeGreaterThan(250);
  });

  it("is not fooled by a comment that mentions .collect()", () => {
    const commented = scan.replace(
      "    const rows = await ctx.db",
      "    // Prose about .collect() and ctx.db.query(\"jobs\") that is not code.\n    // @full-scan-ok: fixture.\n    const rows = await ctx.db",
    );
    const { ok, output } = withFixture(commented, "lint-table-scans.mjs");
    expect(ok, output).toBe(true);
  });
});
