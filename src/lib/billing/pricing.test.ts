import { describe, expect, it } from "vitest";
import { chargedPrice, countryFromHeader, formatPrice, localHint, MIN_CARD_USD, PACK_PRICES, PACKS, packPrice, PAYABLE_CURRENCIES, perDay, proPrice } from "./pricing";

describe("country pricing", () => {
  it("prices the four Bangladesh packs set by the owner", () => {
    expect(PACKS.map((p) => packPrice("BD", p.id).minor)).toEqual([29000, 49000, 129000, 190000]);
    expect(PACKS.map((p) => p.days)).toEqual([15, 30, 90, 365]);
    expect(proPrice("BD")).toEqual({ country: "BD", currency: "BDT", minor: 49000 });
    expect(proPrice("nope").country).toBe("BD");
  });
  it("falls back to 30 days for an unknown pack", () => {
    expect(packPrice("US", "bogus")).toMatchObject({ pack: "30d", days: 30, minor: 2500, usd: 2500 });
    expect(packPrice("AE", "365d")).toMatchObject({ currency: "AED", minor: 36400, usd: 9900, days: 365 });
  });
  it("never charges a card less than US$9", () => {
    for (const [c, r] of Object.entries(PACK_PRICES)) if (c !== "BD") for (const v of r.usd) expect(v).toBeGreaterThanOrEqual(MIN_CARD_USD);
  });
  it("makes longer packs cheaper per day outside Bangladesh", () => {
    for (const [c, r] of Object.entries(PACK_PRICES)) if (c !== "BD") {
      const perDayUsd = r.usd.map((v, i) => v / PACKS[i].days);
      for (let i = 1; i < perDayUsd.length; i++) expect(perDayUsd[i]).toBeLessThan(perDayUsd[i - 1]);
    }
  });
  it("formats local prices", () => {
    expect(formatPrice(29900, "BDT")).toBe("৳299");
    expect(formatPrice(799, "GBP")).toBe("£7.99");
    expect(formatPrice(2900, "AED")).toBe("AED 29");
    expect(formatPrice(1500, "MYR")).toBe("RM 15");
  });
  it("maps Cloudflare country headers", () => {
    expect(countryFromHeader("ae")).toBe("AE");
    expect(countryFromHeader("IN")).toBe("IN");
    expect(packPrice("IN", "30d")).toMatchObject({ currency: "USD", minor: 2500 });
    expect(countryFromHeader("T1")).toBe("XX");
    expect(countryFromHeader("XX")).toBe("XX");
    expect(countryFromHeader(null)).toBe("BD");
  });
  it("only taka is payable by bKash", () => {
    expect(PAYABLE_CURRENCIES).toEqual(["BDT"]);
  });
});

describe("perDay", () => {
  it("turns ৳490 a month into ৳17 a day", () => {
    expect(perDay(proPrice("BD"))).toBe("৳17");
  });
  it("rounds other currencies up to the cent", () => {
    expect(perDay(proPrice("US"))).toBe("$0.84");
  });
});

describe("charged price", () => {
  it("shows the dollar amount a UK card is charged, with pounds only as a guide", () => {
    const p = packPrice("GB", "30d");
    expect(chargedPrice(p)).toEqual({ minor: 2500, currency: "USD" });
    expect(localHint(p)).toBe("about £18.99");
  });
  it("needs no guide where the local currency is the one charged", () => {
    expect(chargedPrice(packPrice("BD", "30d"))).toEqual({ minor: 49000, currency: "BDT" });
    expect(localHint(packPrice("BD", "30d"))).toBeNull();
    expect(localHint(packPrice("US", "30d"))).toBeNull();
    expect(localHint(packPrice("XX", "30d"))).toBeNull();
  });
});
