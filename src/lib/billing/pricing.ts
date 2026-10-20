// Pro price per country the user wants to work in (profiles.target_country, owner decision 2026-10-20).
// Bangladesh pays in taka with bKash; every other country pays by card through Lemon Squeezy, charged in US dollars
// (CARD_USD below) while the local price is shown next to it.
// The database table plan_prices is the source of truth for the shown price; this table is the fallback and the seed.
import { cc, type CountryCode } from "../countries";

export interface Price { country: CountryCode; currency: string; minor: number }

// Outside Bangladesh no price is under US$9 (owner decision 2026-10-20); local amounts are about that or more.
export const PRO_PRICES: Record<CountryCode, { currency: string; minor: number }> = {
  BD: { currency: "BDT", minor: 19000 },
  AE: { currency: "AED", minor: 3500 },
  SA: { currency: "SAR", minor: 3500 },
  MY: { currency: "MYR", minor: 4200 },
  GB: { currency: "GBP", minor: 799 },
  CA: { currency: "CAD", minor: 1299 },
  AU: { currency: "AUD", minor: 1499 },
  US: { currency: "USD", minor: 999 },
  XX: { currency: "USD", minor: 900 },
};

/** Currencies bKash can take. */
export const PAYABLE_CURRENCIES = ["BDT"];

/** What a card payment through Lemon Squeezy charges, in US cents, per target country (about the local price). */
export const CARD_USD: Record<CountryCode, number> = { BD: 0, AE: 949, SA: 949, MY: 949, GB: 1049, CA: 949, AU: 999, US: 999, XX: 900 };
export const MIN_CARD_USD = 900;
export const cardUsd = (country: unknown) => CARD_USD[cc(country)] || CARD_USD.XX;

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
