import { describe, expect, it } from "vitest";
import { CARD_USD, cardUsd, countryFromHeader, formatPrice, MIN_CARD_USD, PAYABLE_CURRENCIES, perDay, proPrice } from "./pricing";

describe("country pricing", () => {
  it("charges ৳190 in Bangladesh and the Gulf at 35", () => {
    expect(proPrice("BD")).toEqual({ country: "BD", currency: "BDT", minor: 19000 });
    expect(proPrice("AE")).toEqual({ country: "AE", currency: "AED", minor: 3500 });
    expect(proPrice("SA")).toEqual({ country: "SA", currency: "SAR", minor: 3500 });
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
  it("never charges a card less than US$9", () => {
    for (const [c, v] of Object.entries(CARD_USD)) if (c !== "BD") expect(v).toBeGreaterThanOrEqual(MIN_CARD_USD);
    expect(cardUsd("nope")).toBe(900);
    expect(cardUsd("GB")).toBe(1049);
  });
  it("only taka is payable today", () => {
    expect(PAYABLE_CURRENCIES).toEqual(["BDT"]);
  });
});

describe("perDay", () => {
  it("turns ৳190 a month into ৳7 a day", () => {
    expect(perDay(proPrice("BD"))).toBe("৳7");
  });
  it("rounds other currencies up to the cent", () => {
    expect(perDay(proPrice("US"))).toBe("$0.34");
  });
});
