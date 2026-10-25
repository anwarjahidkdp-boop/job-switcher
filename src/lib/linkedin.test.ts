import { describe, expect, it } from "vitest";
import { linkedinKit, linkedinUrl, LI_LIMITS } from "./linkedin";
import { DEMO_MASTER } from "./demo";

describe("linkedinKit", () => {
  const kit = linkedinKit(DEMO_MASTER, { targetRoles: ["Accounts Manager", "Finance Manager", "accounts manager"], country: "BD", locations: ["Dhaka"], mode: "On-site" });
  it("writes a headline from the current job and the CV's strengths, within LinkedIn's limit", () => {
    expect(kit.headline).toBe("Senior Executive, Accounts at Meghna Textile Mills Ltd. | Financial Reporting · VAT & Tax · Team Supervision");
    expect(kit.headline.length).toBeLessThanOrEqual(LI_LIMITS.headline);
  });
  it("uses only what the CV says and keeps every section within its limit", () => {
    expect(kit.about.startsWith(DEMO_MASTER.summary)).toBe(true);
    expect(kit.about).toContain("• Financial reporting");
    expect(kit.about).toContain("Accounts Manager, Finance Manager roles in Dhaka");
    expect(kit.about.length).toBeLessThanOrEqual(LI_LIMITS.about);
    expect(kit.experience[0]).toMatchObject({ title: "Senior Executive, Accounts", dates: "Jan 2021 – Present" });
    expect(kit.experience[1].dates).toBe("Jul 2017 – Dec 2020");
    expect(kit.experience[0].description.split("\n")).toHaveLength(4);
    expect(kit.skills).toContain("Tally ERP 9");
    expect(kit.topSkills).toHaveLength(5);
    expect(kit.openTo).toEqual({ titles: ["Accounts Manager", "Finance Manager"], location: "Dhaka", mode: "On-site" });
    expect(kit.tips.some((t) => /Bangla and English/.test(t))).toBe(true);
  });
  it("trims long text at whole lines, never mid-sentence", () => {
    const long = linkedinKit({ ...DEMO_MASTER, summary: "x".repeat(2500) }, { targetRoles: [], country: "GB" });
    expect(long.about.length).toBeLessThanOrEqual(LI_LIMITS.about);
    expect(long.tips.some((t) => /UK CV has no photo/.test(t))).toBe(true);
  });
});

describe("linkedinUrl", () => {
  it("accepts only public LinkedIn profile links", () => {
    expect(linkedinUrl("linkedin.com/in/rahim-uddin")).toBe("https://www.linkedin.com/in/rahim-uddin");
    expect(linkedinUrl("https://bd.linkedin.com/in/rahim-uddin/")).toBe("https://www.linkedin.com/in/rahim-uddin");
    expect(linkedinUrl("https://evil.com/in/rahim")).toBeNull();
    expect(linkedinUrl("https://linkedin.com.evil.com/in/rahim")).toBeNull();
    expect(linkedinUrl("https://www.linkedin.com/company/acme")).toBeNull();
    expect(linkedinUrl("javascript:alert(1)")).toBeNull();
  });
});
