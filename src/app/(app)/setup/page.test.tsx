import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";

const h = vi.hoisted(() => ({ steps: {} as Record<string, unknown> }));
function q() { const o: Record<string, unknown> = {}; for (const m of ["select", "eq"]) o[m] = () => o; o.then = (r: (v: unknown) => void) => r({ count: 0 }); return o; }
vi.mock("@/lib/server/page", () => ({
  requireAppState: async () => ({
    st: { userId: "u1", country: "BD", P: { name: "Md. Rahim Ahmed", targetRoles: ["Accounts Manager"] }, profile: { email: "rahim@gmail.com", setup_steps: h.steps } },
    db: { rpc: async () => ({ data: { alias: "rahim7k2", gmail_verification_code: null, gmail_verification_link: null, gmail_code_received_at: null } }), from: () => q() },
  }),
}));
vi.mock("@/lib/env", async (orig) => { const m = await orig<typeof import("@/lib/env")>(); return { ...m, publicEnv: { ...m.publicEnv, inboundDomain: "jobpao.app" } }; });
vi.mock("@/app/actions", () => ({ completeSetupStepAction: () => undefined, resetSiteSetupAction: () => undefined, toggleSetupStepAction: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));

async function render(site = "Bdjobs") {
  const { default: Setup } = await import("./page");
  return renderToStaticMarkup(await Setup({ searchParams: Promise.resolve({ site }) }));
}

describe("job alert setup", () => {
  beforeEach(() => { h.steps = {}; });

  it("asks only for Hot Job Notification on Bdjobs, with no same-or-new email question", async () => {
    const html = await render();
    if (process.env.DUMP_SETUP) writeFileSync(`${process.env.DUMP_SETUP}-1.html`, html);
    expect(html).toContain("Hot Job Notification");
    expect(html).toContain("Open Bdjobs ↗");
    expect(html).not.toMatch(/same email|new email|which email/i);
    expect(html).toContain('target="_blank"');
  });

  it("step 2 gives the address, the Gmail forwarding link and phone help", async () => {
    h.steps = { "alerts:Bdjobs": true };
    const html = await render();
    if (process.env.DUMP_SETUP) writeFileSync(`${process.env.DUMP_SETUP}-2.html`, html);
    expect(html).toContain("rahim7k2@");
    expect(html).toContain("https://mail.google.com/mail/u/rahim%40gmail.com/#settings/fwdandpop");
    expect(html).toContain("Desktop site");
    expect(html).toContain("Email me these steps");
  });

  it("step 3 opens a ready-made filter for Bdjobs only", async () => {
    h.steps = { "alerts:Bdjobs": true, forward: true };
    const html = await render();
    if (process.env.DUMP_SETUP) writeFileSync(`${process.env.DUMP_SETUP}-3.html`, html);
    expect(html).toContain("#create-filter/from=");
    expect(html).toContain("Open the ready-made filter ↗");
  });
});
