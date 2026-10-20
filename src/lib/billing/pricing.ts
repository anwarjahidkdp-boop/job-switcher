// Pro price per country the user lives in (profiles.home_country). Bangladesh is the launch market and the only
// country where payment works today (bKash, taka). Other prices are shown so people know the cost; paying in
// those currencies needs an international card provider, which is not built yet.
// The database table plan_prices is the source of truth; this table is the fallback and the seed.
import { cc, type CountryCode } from "../countries";

export interface Price { country: CountryCode; currency: string; minor: number }

export const PRO_PRICES: Record<CountryCode, { currency: string; minor: number }> = {
  BD: { currency: "BDT", minor: 19000 },
  AE: { currency: "AED", minor: 2900 },
  SA: { currency: "SAR", minor: 2900 },
  MY: { currency: "MYR", minor: 1500 },
  GB: { currency: "GBP", minor: 799 },
  CA: { currency: "CAD", minor: 1299 },
  AU: { currency: "AUD", minor: 1499 },
  US: { currency: "USD", minor: 999 },
  XX: { currency: "USD", minor: 499 },
};

/** Currencies that can be paid today. */
export const PAYABLE_CURRENCIES = ["BDT"];

export function proPrice(country: unknown): Price {
  const c = cc(country);
  return { country: c, ...PRO_PRICES[c] };
}

const SYMBOL: Record<string, string> = { BDT: "৳", AED: "AED ", SAR: "SAR ", MYR: "RM ", GBP: "£", CAD: "C$", AUD: "A$", USD: "$" };

export function formatPrice(minor: number, currency: string): string {
  const v = minor / 100;
  const digits = Number.isInteger(v) ? 0 : 2;
  const n = v.toLocaleString(currency === "BDT" ? "en-IN" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${SYMBOL[currency] ?? `${currency} `}${n}`;
}

/** The monthly price as a daily amount, rounded up: whole taka in Bangladesh (৳190 → ৳7), cents elsewhere. */
export function perDay(p: { minor: number; currency: string }): string {
  const day = p.currency === "BDT" ? Math.ceil(p.minor / 30 / 100) * 100 : Math.ceil(p.minor / 30);
  return formatPrice(day, p.currency);
}

/** Country from Cloudflare's CF-IPCountry header, mapped to a supported price country (others fall back to XX). */
export function countryFromHeader(v: string | null | undefined): CountryCode {
  const c = String(v || "").toUpperCase();
  return c in PRO_PRICES && c !== "XX" ? (c as CountryCode) : c ? "XX" : "BD";
}
