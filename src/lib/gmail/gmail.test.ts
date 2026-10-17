import { describe, expect, it } from "vitest";
import { base64url, buildMime, cleanAddress, encodeHeader, fromHeader } from "./mime";
import { openToken, sealToken } from "./crypto";

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)));
const decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\r\n/g, "")), (c) => c.charCodeAt(0)));

describe("gmail mime", () => {
  it("builds a message with the email text and attachments", () => {
    const raw = buildMime({ from: "a@gmail.com", to: "hr@company.com", subject: "Application: Accountant", text: "Dear HR,\nPlease find my CV.", attachments: [{ filename: "Rahim-CV.doc", contentType: "application/msword", content: "<html>cv</html>" }], boundary: "B" });
    expect(raw).toContain("To: hr@company.com\r\n");
    expect(raw).toContain("Subject: Application: Accountant\r\n");
    expect(raw).toContain('Content-Type: multipart/mixed; boundary="B"');
    expect(raw).toContain('filename="Rahim-CV.doc"');
    const parts = raw.split("--B");
    expect(decode(parts[1].split("\r\n\r\n")[1])).toBe("Dear HR,\r\nPlease find my CV.");
    expect(decode(parts[2].split("\r\n\r\n")[1])).toBe("<html>cv</html>");
    expect(raw.trimEnd().endsWith("--B--")).toBe(true);
  });
  it("encodes non-English subjects and names", () => {
    expect(encodeHeader("আবেদন")).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(fromHeader("রহিম", "r@gmail.com")).toMatch(/^=\?UTF-8\?B\?.+\?= <r@gmail.com>$/);
    expect(fromHeader("Rahim Uddin", "r@gmail.com")).toBe('"Rahim Uddin" <r@gmail.com>');
  });
  it("refuses addresses that could add recipients or headers", () => {
    expect(() => cleanAddress("hr@a.com, boss@b.com")).toThrow();
    expect(() => cleanAddress("hr@a.com\r\nBcc: x@y.com")).toThrow();
    expect(() => cleanAddress("not-an-email")).toThrow();
    expect(cleanAddress(" hr@a.com ")).toBe("hr@a.com");
  });
  it("strips newlines from subjects", () => {
    expect(buildMime({ from: "a@b.co", to: "c@d.co", subject: "Hi\r\nBcc: e@f.co", text: "x" })).toContain("Subject: Hi Bcc: e@f.co\r\n");
  });
  it("base64url has no padding or unsafe characters", () => {
    expect(base64url("??>>")).not.toMatch(/[+/=]/);
  });
});

describe("token sealing", () => {
  it("round-trips and is bound to the user", async () => {
    const s = await sealToken("refresh-123", KEY, "user-1");
    expect(s.startsWith("v1.")).toBe(true);
    expect(s).not.toContain("refresh-123");
    expect(await openToken(s, KEY, "user-1")).toBe("refresh-123");
    await expect(openToken(s, KEY, "user-2")).rejects.toBeTruthy();
  });
});
