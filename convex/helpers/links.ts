/**
 * Profile contact details: social links and phone number.
 *
 * Links are rendered into `href` attributes, so an unsanitised value here is
 * a stored-XSS hole — `javascript:alert(1)` in a profile field executes for
 * every viewer. Everything is forced through `sanitizeUrl`, which accepts
 * http(s) only and rejects anything else outright rather than trying to
 * repair it.
 *
 * Users paste these in every shape imaginable ("linkedin.com/in/me",
 * "@handle", "www.site.com"), so a bare host gets https:// prepended before
 * validation rather than being thrown away.
 */

export type ProfileLinks = {
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  github?: string;
  website?: string;
};

export const LINK_KEYS = [
  "linkedin",
  "facebook",
  "instagram",
  "github",
  "website",
] as const;

export type LinkKey = (typeof LINK_KEYS)[number];

/** Max stored length. Long enough for real profile URLs, short enough to bound. */
const MAX_URL = 300;

/**
 * Returns a safe absolute https/http URL, or null when the input cannot be
 * made into one. Never throws.
 */
export function sanitizeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  if (!text) return null;
  if (text.length > MAX_URL) return null;

  // Reject control characters outright: they are used to smuggle a scheme
  // past naive checks (e.g. "java\nscript:").
  if (/[\u0000-\u001f\u007f]/.test(text)) return null;

  // A bare host or path is the common paste. Only prepend when there is no
  // scheme at all; do not "fix" an explicit one we would otherwise reject.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) {
    text = "https://" + text;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // Must have a real host with a dot — rejects "https://localhost" style
  // values and anything that parsed but is not a public address.
  if (!url.hostname || !url.hostname.includes(".")) return null;

  return url.toString();
}

/** Sanitise every link on a profile, dropping the ones that do not survive. */
export function sanitizeLinks(
  input: ProfileLinks | undefined,
): ProfileLinks | undefined {
  if (!input) return undefined;
  const out: ProfileLinks = {};
  let any = false;
  for (const key of LINK_KEYS) {
    const safe = sanitizeUrl(input[key]);
    if (safe) {
      out[key] = safe;
      any = true;
    }
  }
  return any ? out : undefined;
}

/**
 * Light normalisation for a phone number: trim, collapse whitespace, cap the
 * length. Deliberately not reformatted to a canonical shape — alumni are
 * international and a "helpful" rewrite mangles perfectly valid numbers.
 */
export function sanitizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const text = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return text.length > 0 ? text : undefined;
}

/** Free-text address line: strip control characters, cap length. */
export function sanitizeAddress(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const text = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, 200);
  return text.length > 0 ? text : undefined;
}

/** Display label for a link, e.g. "linkedin.com/in/jaezar". */
export function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    return u.hostname.replace(/^www\./, "") + path;
  } catch {
    return url;
  }
}
