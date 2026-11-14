import { describe, expect, it } from "vitest";
import { paymentEmail } from "./templates";

describe("paymentEmail", () => {
  const base = { kind: "approved" as const, name: "Sarah Collins", amount: "$25.00", trx: "ord_123", periodEnd: "2026-12-14T15:14:14Z", note: null, link: "https://jobpao.app/upgrade" };
  it("names a card payment and its order, never bKash", () => {
    const m = paymentEmail({ ...base, method: "card" });
    expect(m.text).toContain("$25.00 card payment (order ord_123)");
    expect(m.text).not.toMatch(/bkash|TrxID/i);
  });
  it("keeps the bKash wording for bKash payments", () => {
    expect(paymentEmail({ ...base, amount: "৳650", trx: "ABC123" }).text).toContain("৳650 bKash payment (TrxID ABC123)");
  });
});
