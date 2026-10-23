import { setupRequirements } from "@/lib/eligibility";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { profileOf, requireUser, trialLabel } from "@/lib/server/page";
import { cname } from "@/lib/countries";
import { unreadCount } from "@/lib/server/notify";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser("/inbox");
  const [profile,trial,unread] = await Promise.all([profileOf(supabase,user.id),trialLabel(supabase,user.id),unreadCount(supabase,user.id)]);
  if(profile&&setupRequirements(profile).length)redirect("/onboarding?step=prefs");
  // The last onboarding step shows the finished CV, so leaving it for any app page (e.g. "My dashboard") finishes onboarding.
  if (profile?.onboarding_step === "reveal") {
    await supabase.from("profiles").update({ onboarding_step: "done" }).eq("id", user.id);
    profile.onboarding_step = "done";
  }
  if (!profile || profile.onboarding_step !== "done") redirect("/onboarding");
  return (
    <>
      <SiteHeader inApp countryName={cname(profile.target_country)} trialLabel={trial} unread={unread} />
      <main className="app-main"><div className="wrap">{children}</div></main>
      <SiteFooter signedIn />
    </>
  );
}
