import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { requireUser, trialLabel } from "@/lib/server/page";
import { loadProfile } from "@/lib/server/state";
import { cname } from "@/lib/countries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser("/inbox");
  const profile = await loadProfile(supabase, user.id);
  if (!profile || profile.onboarding_step !== "done") redirect("/onboarding");
  const trial = await trialLabel(supabase, user.id);
  return (
    <>
      <SiteHeader inApp countryName={cname(profile.target_country)} trialLabel={trial} />
      <main><div className="wrap">{children}</div></main>
      <SiteFooter signedIn />
    </>
  );
}
