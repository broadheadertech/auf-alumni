import { describe, it, expect } from "vitest";
import {
  sanitizeUrl,
  sanitizeLinks,
  sanitizePhone,
  sanitizeAddress,
  linkLabel,
} from "../helpers/links";

describe("sanitizeUrl — rejects anything that is not http(s)", () => {
  // These are the reason this helper exists: the value lands in an href.
  const hostile = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "about:blank",
  ];

  for (const value of hostile) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(sanitizeUrl(value)).toBeNull();
    });
  }

  it("does not let a control character smuggle a scheme through", () => {
    expect(sanitizeUrl("java\u0000script:alert(1)")).toBeNull();
    expect(sanitizeUrl("java\tscript:alert(1)")).toBeNull();
  });

  it("does not 'repair' a rejected scheme by prefixing https", () => {
    // The bare-host branch must not fire for an explicit hostile scheme.
    const out = sanitizeUrl("javascript:alert(1)");
    // Null, not "https://javascript:alert(1)" — the bare-host branch must
    // not fire once an explicit scheme is present.
    expect(out).toBeNull();
  });
});

describe("sanitizeUrl — accepts real input", () => {
  it("keeps a full https URL", () => {
    expect(sanitizeUrl("https://linkedin.com/in/jaezar")).toBe(
      "https://linkedin.com/in/jaezar",
    );
  });

  it("prepends https to a bare host", () => {
    expect(sanitizeUrl("linkedin.com/in/jaezar")).toBe(
      "https://linkedin.com/in/jaezar",
    );
    expect(sanitizeUrl("www.example.com")).toBe("https://www.example.com/");
  });

  it("allows plain http", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects a host with no dot", () => {
    expect(sanitizeUrl("localhost")).toBeNull();
    expect(sanitizeUrl("https://localhost")).toBeNull();
  });

  it("rejects empty and over-long values", () => {
    expect(sanitizeUrl("")).toBeNull();
    expect(sanitizeUrl("   ")).toBeNull();
    expect(sanitizeUrl(undefined)).toBeNull();
    expect(sanitizeUrl("https://e.com/" + "a".repeat(400))).toBeNull();
  });
});

describe("sanitizeLinks", () => {
  it("keeps the good ones and drops the bad ones", () => {
    expect(
      sanitizeLinks({
        linkedin: "linkedin.com/in/me",
        facebook: "javascript:alert(1)",
        website: "   ",
      }),
    ).toEqual({ linkedin: "https://linkedin.com/in/me" });
  });

  it("returns undefined when nothing survives", () => {
    expect(sanitizeLinks({ facebook: "javascript:alert(1)" })).toBeUndefined();
    expect(sanitizeLinks({})).toBeUndefined();
    expect(sanitizeLinks(undefined)).toBeUndefined();
  });
});

describe("sanitizePhone", () => {
  it("collapses whitespace and keeps the number intact", () => {
    expect(sanitizePhone("  +63  917   555 0101 ")).toBe("+63 917 555 0101");
  });

  it("does not reformat an international number", () => {
    expect(sanitizePhone("(02) 8888-1234")).toBe("(02) 8888-1234");
  });

  it("strips control characters and caps length", () => {
    expect(sanitizePhone("+63\u0000917")).toBe("+63917");
    expect(sanitizePhone("9".repeat(60))?.length).toBe(40);
  });

  it("returns undefined for empty input", () => {
    expect(sanitizePhone("   ")).toBeUndefined();
    expect(sanitizePhone(undefined)).toBeUndefined();
  });
});

describe("sanitizeAddress", () => {
  it("trims and caps", () => {
    expect(sanitizeAddress("  12 Rizal St.  ")).toBe("12 Rizal St.");
    expect(sanitizeAddress("a".repeat(300))?.length).toBe(200);
  });

  it("strips control characters", () => {
    expect(sanitizeAddress("12 Rizal\u0000 St.")).toBe("12 Rizal St.");
  });
});

describe("linkLabel", () => {
  it("drops the scheme, www and trailing slash", () => {
    expect(linkLabel("https://www.linkedin.com/in/jaezar/")).toBe(
      "linkedin.com/in/jaezar",
    );
  });
});
