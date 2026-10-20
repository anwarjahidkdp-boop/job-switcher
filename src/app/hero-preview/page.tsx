import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { HeroPhone } from "../HeroPhone";
import { Picker, type Photo } from "./Picker";

// Owner-only design preview (not linked anywhere). Free Unsplash License photos, hotlinked with credit.
export const metadata = { title: "Hero preview", robots: { index: false, follow: false } };

const PHOTOS: Photo[] = [
  { id: "photo-1758873267202-44c33e64f084", by: "Vitaly Gariev", page: "https://unsplash.com/photos/man-smiling-at-laptop-in-modern-office-ZMvGLiSDtGs", label: "Man smiling at his laptop in an office" },
  { id: "photo-1713947503689-d5e1d303bb4a", by: "Vitaly Gariev", page: "https://unsplash.com/photos/a-man-sitting-in-front-of-a-laptop-computer-GWnwuXvvRvU", label: "Young man at a laptop, smiling" },
  { id: "photo-1752650735119-8929e5f7d1ec", by: "Vitaly Gariev", page: "https://unsplash.com/photos/smiling-woman-works-on-her-laptop-eQryxYGXsu0", label: "Woman smiling at her laptop" },
  { id: "photo-1758874573562-5bf0c1a7fc72", by: "Vitaly Gariev", page: "https://unsplash.com/photos/a-man-smiles-while-working-on-a-laptop-M9gGJqvAMGE", label: "Man smiling while working on a laptop" },
  { id: "photo-1771244688590-1e481dba1b5a", by: "Unsplash", page: "https://unsplash.com/photos/man-in-suit-sitting-at-desk-with-laptop-and-coffee-kgc1vAw1Tl8", label: "Man in a suit at a desk with a laptop" },
  { id: "photo-1742981365880-698cfb84492d", by: "Unsplash", page: "https://unsplash.com/photos/a-man-in-a-suit-sits-at-a-desk-zLx710peU_k", label: "Man in a suit at a desk" },
];

export default function HeroPreview() {
  return (
    <>
      <SiteHeader inApp={false} />
      <main className="lp">
        <section className="lp-hero">
          <div className="wrap" style={{ paddingTop: 28 }}>
            <p className="lp-tag"><span className="lp-dot" />Hero preview: pick a look</p>
            <h2 style={{ color: "#fff", marginTop: 14, fontSize: 22 }}>Option 1: photo with floating cards (tap a number to change the photo)</h2>
          </div>
          <div className="wrap lp-hero-in hv-in">
            <div>
              <h1>Your job <span>assistant.</span></h1>
              <ul className="lp-pts">
                <li><div><b>Finds your best-matched jobs</b></div></li>
                <li><div><b>Prepares every application</b></div></li>
                <li><div><b>Gets you ready for the interview</b></div></li>
              </ul>
              <div className="lp-cta"><Link className="btn btn-primary lp-btn" href="/login?mode=signup&next=/onboarding">Upload my CV</Link></div>
            </div>
            <div><Picker photos={PHOTOS} /></div>
          </div>
          <div className="wrap"><h2 style={{ color: "#fff", fontSize: 22 }}>Option 2: phone demo (no photo)</h2></div>
          <div className="wrap lp-hero-in">
            <div><h1>Your job <span>assistant.</span></h1></div>
            <HeroPhone />
          </div>
        </section>
      </main>
    </>
  );
}
