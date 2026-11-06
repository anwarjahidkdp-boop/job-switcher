import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));
vi.mock("@/app/actions", () => ({}));
import { ContactPanel } from "./client";
import { LoginForm } from "@/app/login/LoginForm";

describe("contact details", () => {
  it("shows the login email, the CV phone and email, and personal details", () => {
    const html = renderToStaticMarkup(<ContactPanel loginEmail="rahim@gmail.com" phone="+880 1711-000000" cvEmail="" onCv="rahim@gmail.com · +880 1711-000000 · Dhaka" details={[["Full name", "Md. Rahim Ahmed"], ["City", "Dhaka"], ["Date of birth", "1990-05-14"], ["Father's name", "Abdul Karim"]]} />);
    if (process.env.DUMP_CONTACT) writeFileSync(`${process.env.DUMP_CONTACT}-profile.html`, html);
    for (const t of ["Signed in as", "rahim@gmail.com", "Mobile number (used on your CV)", "Same as my login email", "On your CV:", "Father&#x27;s name", "Edit personal details"]) expect(html).toContain(t);
  });
  it("asks for a mobile number at signup", () => {
    const html = renderToStaticMarkup(<LoginForm initial="signup" next="/onboarding?import=1" />);
    if (process.env.DUMP_CONTACT) writeFileSync(`${process.env.DUMP_CONTACT}-signup.html`, html);
    expect(html).toContain('id="phone"');
    expect(html).toContain("Used on your CV with this email");
  });
});
