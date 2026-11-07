/**
 * Safe serialisation for JSON-LD embedded in a <script> tag.
 *
 * `JSON.stringify` escapes quotes and backslashes but NOT `<`, so any
 * user-controlled string reaching a `<script type="application/ld+json">`
 * block can close it early: a display name containing a closing script tag
 * ends the block regardless of the JSON context, and whatever follows is
 * parsed as markup. On the public profile page that meant a member could run
 * script in every visitor's browser just by choosing a display name.
 *
 * Escaping the angle brackets as unicode escapes keeps the JSON semantically
 * identical -- a JSON parser reads \u003c as "<" -- while leaving the HTML
 * parser nothing to latch onto. U+2028 and U+2029 are escaped too: they are
 * legal inside JSON strings but are line terminators in JavaScript source.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
