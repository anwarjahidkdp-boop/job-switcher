import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Search engines see the public pages only; signed-in app pages and APIs stay out of results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/admin", "/hero-preview", "/onboarding", "/inbox", "/notifications", "/jobs", "/queue", "/applications", "/insights", "/linkedin", "/profile", "/setup", "/upgrade", "/account", "/opportunities"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
