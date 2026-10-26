import { describe, expect, it } from "vitest";
import { scamCheck } from "./scam-check";

const job = { title: "Accounts Officer", company: "Acme Ltd", apply: { method: "portal" as const, target: null } };

describe("scamCheck", () => {
  it("flags a fee or deposit as a strong warning", () => {
    expect(scamCheck(job, "Selected candidates must pay a registration fee of Tk 2,000 before joining.").level).toBe("high");
    expect(scamCheck(job, "চাকরির জন্য ৫০০০ টাকা জামানত দিতে হবে।").level).toBe("high");
    expect(scamCheck(job, "Send your bank account details and OTP to confirm the offer.").level).toBe("high");
  });
  it("does not flag posts that say they never charge, or the official Teletalk government fee", () => {
    expect(scamCheck(job, "We never charge any fee at any stage of recruitment.").level).toBe("none");
    expect(scamCheck(job, "Application fee Tk 112 must be paid by Teletalk prepaid SMS.").level).toBe("none");
    expect(scamCheck(job, "Prepare monthly financial reports and handle VAT returns. Manage accounts payable and payment schedules.").level).toBe("none");
  });
  it("needs two weak signs for a caution", () => {
    expect(scamCheck(job, "Apply on WhatsApp only.").level).toBe("none");
    const c = scamCheck(job, "Apply on WhatsApp only. Guaranteed job for everyone.");
    expect(c.level).toBe("caution");
    expect(c.reasons).toHaveLength(2);
  });
  it("counts a free personal mailbox for a named company as one weak sign", () => {
    const j = { ...job, apply: { method: "email" as const, target: "acme.hr2026@gmail.com" } };
    expect(scamCheck(j, "Earn $300 per day from home.").level).toBe("caution");
  });
});
