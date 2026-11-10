/**
 * Program → college classification from the admin-managed taxonomy tables.
 *
 * Profiles store `program` by name; every server-side college breakdown
 * (roster, dashboard, analytics) must classify through these tables so the
 * numbers match the pickers and filters. The keyword match is only a fallback
 * for legacy free-text programs that aren't in the taxonomy yet.
 */

import type { QueryCtx } from "../_generated/server";

const COLLEGE_RULES: Array<[RegExp, string]> = [
  [/comput|informa|software|data sci|\bit\b|information tech/i, "College of Computer Studies"],
  [/engineer|architect/i, "College of Engineering & Architecture"],
  [/business|account|management|marketing|finance|entrep|commerce|economic/i, "College of Business & Accountancy"],
  [/nurs/i, "College of Nursing"],
  [/medic|pharmac|physical therapy|medical tech|radiolog|allied|therapy|dentis/i, "College of Allied Medical Professions"],
  [/educat|teaching|elementary|secondary/i, "College of Education"],
];

function keywordCollege(program: string): string {
  for (const [re, college] of COLLEGE_RULES) {
    if (re.test(program)) return college;
  }
  return "College of Arts & Sciences";
}

export type CollegeClassifier = (program: string) => string;

/** Load the taxonomy once per request and return a program → college function. */
export async function loadCollegeClassifier(ctx: QueryCtx): Promise<CollegeClassifier> {
  const [colleges, programs] = await Promise.all([
    // @full-scan-ok: small reference table, read once per request to build a program-to-college lookup
    ctx.db.query("colleges").collect(),
    // @full-scan-ok: small reference table, read once per request to build a program-to-college lookup
    ctx.db.query("programs").collect(),
  ]);
  const collegeName = new Map(colleges.map((c) => [c._id, c.name]));
  const byProgram = new Map<string, string>();
  for (const p of programs) {
    const name = collegeName.get(p.collegeId);
    if (name) byProgram.set(p.name.trim().toLowerCase(), name);
  }
  return (program: string) =>
    byProgram.get(program.trim().toLowerCase()) ?? keywordCollege(program);
}
