import { describe, expect, it } from "vitest";
import { detectGmailVerification } from "./gmail";
import { aliasFrom, parseRawEmail } from "./parse";

const RAW = [
  "From: Gmail Team <forwarding-noreply@google.com>",
  "To: rahim-3f9a1c@jobs.example.com",
  "Subject: (#842917365) Gmail Forwarding Confirmation - Receive Mail from rahim.uddin@gmail.com",
  "Message-ID: <abc123@google.com>",
  "Content-Type: text/plain; charset=UTF-8",
  "",
  "rahim.uddin@gmail.com has requested to automatically forward mail to your email",
  "address rahim-3f9a1c@jobs.example.com.",
  "Confirmation code: 842917365",
  "",
].join("\r\n");

describe("Gmail forwarding verification", () => {
  it("parses the raw email and extracts the code", async () => {
    const m = await parseRawEmail(RAW);
    expect(m.messageId).toContain("abc123");
    const v = detectGmailVerification(m);
    expect(v).toEqual({ code: "842917365", forwardingFrom: "rahim.uddin@gmail.com" });
  });
  it("ignores lookalike senders", () => {
    expect(detectGmailVerification({ from: "Gmail <forwarding-noreply@g00gle.com>", subject: "(#123456789) Gmail Forwarding Confirmation", text: "Confirmation code: 123456789" })).toBeNull();
  });
  it("requires Google authentication when results are present", () => {
    const base = { from: "<forwarding-noreply@google.com>", subject: "(#123456789) Gmail Forwarding Confirmation", text: "" };
    expect(detectGmailVerification({ ...base, authResults: "mx.cloudflare.net; dkim=fail; spf=fail" })).toBeNull();
    expect(detectGmailVerification({ ...base, authResults: "mx.cloudflare.net; dkim=pass header.d=google.com; spf=pass smtp.mailfrom=google.com" })?.code).toBe("123456789");
  });
  it("ignores ordinary job alerts", () => {
    expect(detectGmailVerification({ from: "Bdjobs <alert@bdjobs.com>", subject: "5 new jobs for Accounts Manager", text: "..." })).toBeNull();
  });
});

describe("aliasFrom", () => {
  it("accepts aliases on our domain only", () => {
    expect(aliasFrom("Rahim-3f9a1c@jobs.example.com", "jobs.example.com")).toBe("rahim-3f9a1c");
    expect(aliasFrom("rahim-3f9a1c@evil.com", "jobs.example.com")).toBeNull();
  });
});
