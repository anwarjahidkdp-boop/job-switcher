import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mergeFill } from "./inbound";

describe("AI gap-fill for alert jobs", () => {
  const text = "Accounts Manager\nPearl Gulf Trading - Doha\nApply before 30 Nov 2026\nPayroll Specialist\nRiyadh";
  const items = [
    { title: "Accounts Manager", company: null, location: null, deadline: null, url: "https://www.naukrigulf.com/x-jid-121026500123" },
    { title: "Payroll Specialist", company: "Known Co", location: null, deadline: null, url: "https://www.bayt.com/en/x/jobs/payroll-specialist-4988001/" },
  ];
  it("fills only missing fields, and only with values present in the email", () => {
    const out = mergeFill(items, { jobs: [
      { index: 0, title: "Changed Title", company: "Pearl Gulf Trading", location: "Doha", deadline: "2026-11-30" },
      { index: 1, title: null, company: "Invented Holdings", location: "Riyadh", deadline: null },
      { index: 7, title: "x", company: "y", location: null, deadline: null },
    ] }, text);
    expect(out[0]).toMatchObject({ title: "Accounts Manager", company: "Pearl Gulf Trading", location: "Doha", deadline: "2026-11-30" });
    expect(out[1]).toMatchObject({ company: "Known Co", location: "Riyadh" });
  });
  it("drops invented values that are not in the email text", () => {
    const out = mergeFill(items, { jobs: [{ index: 0, title: null, company: "Totally Made Up LLC", location: null, deadline: "soon" }] }, text);
    expect(out[0].company).toBeNull();
    expect(out[0].deadline).toBeNull();
  });
});
