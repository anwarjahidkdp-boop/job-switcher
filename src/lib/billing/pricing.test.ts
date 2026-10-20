import { describe, expect, it } from "vitest";
import { countryFromHeader, formatPrice, PAYABLE_CURRENCIES, perDay, proPrice } from "./pricing";

describe("country pricing", () => {
  it("charges ৳190 in Bangladesh and the Gulf at 29", () => {
    expect(proPrice("BD")).toEqual({ country: "BD", currency: "BDT", minor: 19000 });
    expect(proPrice("AE")).toEqual({ country: "AE", currency: "AED", minor: 2900 });
    expect(proPrice("SA")).toEqual({ country: "SA", currency: "SAR", minor: 2900 });
    expect(proPrice("nope").country).toBe("BD");
  });
  it("formats local prices", () => {
    expect(formatPrice(29900, "BDT")).toBe("৳299");
    expect(formatPrice(799, "GBP")).toBe("£7.99");
    expect(formatPrice(2900, "AED")).toBe("AED 29");
    expect(formatPrice(1500, "MYR")).toBe("RM 15");
  });
  it("maps Cloudflare country headers", () => {
    expect(countryFromHeader("ae")).toBe("AE");
    expect(countryFromHeader("IN")).toBe("XX");
    expect(countryFromHeader("XX")).toBe("XX");
    expect(countryFromHeader(null)).toBe("BD");
  });
  it("only taka is payable today", () => {
    expect(PAYABLE_CURRENCIES).toEqual(["BDT"]);
  });
});

describe("perDay", () => {
  it("turns ৳190 a month into ৳6 a day", () => {
    expect(perDay(proPrice("BD"))).toBe("৳6");
  });
  it("rounds other currencies up to the cent", () => {
    expect(perDay(proPrice("US"))).toBe("$0.34");
  });
});
