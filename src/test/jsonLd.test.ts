import { describe, expect, it } from "vitest";
import { jsonLd } from "@/lib/json-ld";

/**
 * Regression guard for the stored-XSS fix on the public profile page.
 * A display name is user-controlled and lands inside a JSON-LD <script>
 * block; if the serialiser ever stops escaping angle brackets, a crafted
 * name closes the script tag and whatever follows executes.
 */
describe("jsonLd", () => {
  const CLOSING_TAG = "</" + "script>";

  it("escapes angle brackets so a script tag cannot be closed", () => {
    const payload = { name: CLOSING_TAG + "<img src=x onerror=alert(1)>" };
    const out = jsonLd(payload);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain(CLOSING_TAG);
    expect(out).toContain(String.fromCharCode(92) + "u003c");
  });

  it("still parses back to the original value", () => {
    const payload = { name: "Ana " + CLOSING_TAG + " Reyes", batch: 2019 };
    expect(JSON.parse(jsonLd(payload))).toEqual(payload);
  });

  it("escapes JS line terminators that are legal in JSON", () => {
    const out = jsonLd({ bio: "a" + String.fromCharCode(0x2028) + "b" });
    expect(out).toContain(String.fromCharCode(92) + "u2028");
    expect(out).not.toContain(String.fromCharCode(0x2028));
  });
});
