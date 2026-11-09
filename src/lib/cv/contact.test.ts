import { describe, expect, it } from "vitest";
import { cvContact, cvEmailOf, normalisePhone, validEmail } from "./contact";

describe("CV contact from the account", () => {
  it("replaces the CV's email and phone with the account's and keeps the rest", () => {
    expect(cvContact("old@mail.com · 01711-000000 · Dhaka", { email: "new@gmail.com", phone: "+880 1811 222333" })).toBe("new@gmail.com · +880 1811 222333 · Dhaka");
    expect(cvContact("Dhaka | linkedin.com/in/rahim", { email: "a@b.co", phone: null })).toBe("a@b.co · Dhaka · linkedin.com/in/rahim");
  });
  it("keeps the CV's own details when the account has none", () => {
    expect(cvContact("old@mail.com · 01711-000000 · Dhaka", {})).toBe("old@mail.com · 01711-000000 · Dhaka");
  });
  it("uses a chosen CV email over the login email", () => {
    expect(cvEmailOf("login@gmail.com", { cvEmail: "cv@gmail.com" })).toBe("cv@gmail.com");
    expect(cvEmailOf("login@gmail.com", {})).toBe("login@gmail.com");
  });
  it("accepts real phone numbers only", () => {
    expect(normalisePhone(" +880  1711-000000 ")).toBe("+880 1711-000000");
    expect(normalisePhone("07700 900123")).toBe("07700 900123");
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("call me")).toBeNull();
    expect(validEmail("x@y.com")).toBe(true);
    expect(validEmail("x@y")).toBe(false);
  });
});
