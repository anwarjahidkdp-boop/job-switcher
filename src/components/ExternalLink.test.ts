import { describe, expect, it } from "vitest";
import { browserUrl } from "./ExternalLink";

describe("opening job sites outside the installed app", () => {
  const url = "https://mail.google.com/mail/u/0/#settings/fwdandpop";
  it("hands Android links to Chrome itself, with the page as fallback", () => {
    expect(browserUrl(url, "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile")).toBe(`intent://mail.google.com/mail/u/0/#settings/fwdandpop#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`);
  });
  it("hands iPhone links to Safari", () => {
    expect(browserUrl(url, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(`x-safari-${url}`);
  });
  it("leaves computers alone", () => {
    expect(browserUrl(url, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130")).toBeNull();
  });
});
