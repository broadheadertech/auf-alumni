/**
 * Batch (graduation year) filter input: a single year ("2021") or an inclusive
 * range ("2018-2022"). Used by the standard filter panels.
 */

const MIN_YEAR = 1960;

export type BatchInput = {
  /** Years to match, or null when the input is empty or invalid. */
  years: number[] | null;
  /** Human-readable problem, shown under the field. */
  error: string | null;
  /** Stable memo key. */
  key: string;
};

export function parseBatchInput(raw: string): BatchInput {
  const value = raw.trim();
  if (!value) return { years: null, error: null, key: "" };
  const maxYear = new Date().getFullYear() + 1;
  const m = value.match(/^(\d{4})\s*(?:[-–]\s*(\d{4}))?$/);
  if (!m) {
    // Still typing a year — don't nag until 4+ characters.
    return {
      years: null,
      error: value.length >= 4 ? "Enter a year like 2021 or a range like 2018-2022" : null,
      key: "",
    };
  }
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  if (from < MIN_YEAR || to > maxYear) {
    return { years: null, error: `Years must be between ${MIN_YEAR} and ${maxYear}`, key: "" };
  }
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return { years, error: null, key: `${from}-${to}` };
}
