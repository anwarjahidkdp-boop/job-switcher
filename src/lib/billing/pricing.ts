// Pro packs and prices per country the user lives in (profiles.home_country, owner decisions 2026-10-20, as competitors do).
// Four packs, each a one-off payment with no auto-renewal: 15 days, 30 days, 3 months and 1 year.
// People living in Bangladesh pay in taka with bKash; every other country pays by card through Lemon Squeezy, charged in
// US dollars (usd below, about the local price) while the local price is shown next to it.
// Outside Bangladesh no pack costs under US$9. Benchmarks (Oct 2026): Teal $13/week, $29/month, $79/3 months;
// Simplify $39.99/month; Kickresume $24/month; Rezi $29/month. This table is the source of truth.
import { cc, type CountryCode } from "../countries";

export type PackId = "15d" | "30d" | "90d" | "365d";
export const PACKS: { id: PackId; days: number; name: string }[] = [
  { id: "15d", days: 15, name: "15 days" },
  { id: "30d", days: 30, name: "30 days" },
  { id: "90d", days: 90, name: "3 months" },
  { id: "365d", days: 365, name: "1 year" },
];
export const DEFAULT_PACK: PackId = "30d";
export const isPack = (v: unknown): v is PackId => PACKS.some((p) => p.id === v);
export const packOf = (v: unknown) => PACKS.find((p) => p.id === v) ?? PACKS[1];

export interface Price { country: CountryCode; currency: string; minor: number }
export interface PackPrice extends Price { pack: PackId; days: number; name: string; usd: number }

type Quad = [number, number, number, number];
type Row = { currency: string; local: Quad; usd: Quad };
// Minor units for [15 days, 30 days, 3 months, 1 year]. Bangladesh and the card prices ($15, $25, $55) set by the owner
// 2026-10-20; the year is $99. Local amounts are about the card price at Oct 2026 exchange rates.
export const PACK_PRICES: Record<CountryCode, Row> = {
  BD: { currency: "BDT", local: [29000, 49000, 129000, 190000], usd: [0, 0, 0, 0] },
  US: { currency: "USD", local: [1500, 2500, 5500, 9900], usd: [1500, 2500, 5500, 9900] },
  GB: { currency: "GBP", local: [1149, 1899, 4199, 7499], usd: [1500, 2500, 5500, 9900] },
  CA: { currency: "CAD", local: [2099, 3499, 7699, 13700], usd: [1500, 2500, 5500, 9900] },
  AU: { currency: "AUD", local: [2299, 3799, 8399, 14900], usd: [1500, 2500, 5500, 9900] },
  AE: { currency: "AED", local: [5500, 9200, 20200, 36400], usd: [1500, 2500, 5500, 9900] },
  SA: { currency: "SAR", local: [5600, 9400, 20600, 37100], usd: [1500, 2500, 5500, 9900] },
  MY: { currency: "MYR", local: [6600, 11000, 24200, 43600], usd: [1500, 2500, 5500, 9900] },
  XX: { currency: "USD", local: [1500, 2500, 5500, 9900], usd: [1500, 2500, 5500, 9900] },
};

/** Currencies bKash can take. */
export const PAYABLE_CURRENCIES = ["BDT"];
export const MIN_CARD_USD = 900;

export function packPrice(country: unknown, pack: unknown = DEFAULT_PACK): PackPrice {
  const c = cc(country), p = packOf(pack), i = PACKS.indexOf(p), r = PACK_PRICES[c];
  return { country: c, currency: r.currency, minor: r.local[i], usd: r.usd[i], pack: p.id, days: p.days, name: p.name };
}

/** The 30-day price, shown wherever one headline price is needed. */
export const proPrice = (country: unknown): Price => { const { country: c, currency, minor } = packPrice(country); return { country: c, currency, minor }; };

const SYMBOL: Record<string, string> = { BDT: "৳", AED: "AED ", SAR: "SAR ", MYR: "RM ", GBP: "£", CAD: "C$", AUD: "A$", USD: "$" };

export function formatPrice(minor: number, currency: string): string {
  const v = minor / 100;
  const digits = Number.isInteger(v) ? 0 : 2;
  const n = v.toLocaleString(currency === "BDT" ? "en-IN" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${SYMBOL[currency] ?? `${currency} `}${n}`;
}

/** The monthly price as a daily amount, rounded up: whole taka in Bangladesh (৳490 → ৳17), cents elsewhere. */
export function perDay(p: { minor: number; currency: string }): string {
  const day = p.currency === "BDT" ? Math.ceil(p.minor / 30 / 100) * 100 : Math.ceil(p.minor / 30);
  return formatPrice(day, p.currency);
}

/** Country from Cloudflare's CF-IPCountry header, mapped to a supported price country (others fall back to XX). */
export function countryFromHeader(v: string | null | undefined): CountryCode {
  const c = String(v || "").toUpperCase();
  return c in PACK_PRICES && c !== "XX" ? (c as CountryCode) : c ? "XX" : "BD";
}
