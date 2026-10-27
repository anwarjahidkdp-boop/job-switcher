import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The public pages a visitor can open without an account. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/install`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/refund`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
