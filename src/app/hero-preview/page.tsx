import { SiteHeader } from "@/components/SiteHeader";

// Owner-only photo picker for the hero story (not linked anywhere). Free Unsplash photos, hotlinked with credit.
export const metadata = { title: "Hero photos", robots: { index: false, follow: false } };

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&h=460&q=80&crop=faces,edges`;
type Pick = [id: string, label: string, page: string];
const u = (slug: string) => `https://unsplash.com/photos/${slug}`;

const GROUPS: { step: string; note: string; picks: Pick[] }[] = [
  { step: "1 · The match", note: "Good news on the screen: a great job found.", picks: [
    ["photo-1758873267202-44c33e64f084", "Man smiling at laptop (now)", u("man-smiling-at-laptop-in-modern-office-ZMvGLiSDtGs")],
    ["photo-1758518731049-84eef34d8ba2", "Man in suit celebrating at desk", u("man-in-suit-celebrating-success-at-office-desk-ECRBb_DgKPQ")],
    ["photo-1758874384556-ad48ed1c946c", "Young woman celebrating at desk", u("young-woman-celebrating-success-at-her-desk-L048-4WzpFY")],
    ["photo-1758873268783-967d13f0c163", "Woman celebrating at office desk", u("woman-celebrating-success-at-her-office-desk-n9NCev29YvI")],
    ["photo-1758874573672-e2731bd577e7", "Man celebrating at laptop", u("man-celebrating-success-while-working-on-laptop-6ZiVq0VmHns")],
    ["photo-1758519290801-c07424a5142a", "Man in office celebrating with laptop", u("man-in-office-celebrating-success-with-laptop-Ayoppgw5eFU")],
    ["photo-1758519290800-a824cc6dd2ba", "Man celebrating in office", u("man-celebrating-success-in-office-with-laptop-5TNWOr33FNA")],
  ] },
  { step: "2 · The call", note: "The phone rings: an interview call.", picks: [
    ["photo-1758611972271-fce956444233", "Man smiling at phone at desk (now)", u("man-smiling-while-looking-at-his-phone-at-desk-61xM5EIiG5w")],
    ["photo-1758876202189-0fbc277dfed9", "Young woman on phone at office desk", u("young-woman-talking-on-phone-at-office-desk-with-laptop-U1FBiiBgsvw")],
    ["photo-1758876202124-cc941ebb8446", "Woman on phone at office desk", u("woman-talking-on-phone-at-desk-in-office-UPPJYvky81I")],
    ["photo-1758873272222-ccd8c4296864", "Woman on phone in modern office", u("woman-talking-on-phone-in-modern-office-with-chalkboard-wall-N9GPReiNkt0")],
    ["photo-1758519291037-db9ec86cda69", "Man on phone with coffee and laptop", u("man-talking-on-phone-with-coffee-and-laptop-s9JRU4vg9To")],
    ["photo-1758611970051-69f179d83cba", "Man in glasses on a call", u("man-in-glasses-talking-on-a-cell-phone-yzlYsAK3i2E")],
    ["photo-1689848693914-7ba25d9f3334", "Woman at computer on a call", u("a-woman-sitting-in-front-of-a-computer-talking-on-a-cell-phone-wIrTa_D3uNU")],
  ] },
  { step: "3 · The interview", note: "Sitting across the table, prepared.", picks: [
    ["photo-1758518730162-09a142505bfd", "Interview across a table (now)", u("woman-in-suit-interviews-man-across-table-Hl1HIQ0fmQk")],
    ["photo-1758520144437-f068ecaf0d83", "Interviewer in glasses with candidate", u("woman-in-glasses-interviews-man-at-office-desk-pg2eJwNVpvY")],
    ["photo-1758518730264-9235a1e5416b", "Reviewing a CV with the candidate", u("woman-in-suit-reviews-document-with-man-nwmRGqPNu7M")],
    ["photo-1698047681432-006d2449c631", "Interviewer reading a CV", u("a-woman-is-reading-a-resume-at-a-table-9si2noVCVH8")],
    ["photo-1600880292203-757bb62b4baf", "Candidate and interviewer talking", u("man-in-white-dress-shirt-sitting-beside-woman-in-black-long-sleeve-shirt-376KN_ISplE")],
    ["photo-1758518727888-ffa196002e59", "Confident woman in a suit", u("a-professional-woman-in-a-suit-smiling-confidently-LlcpQWSWPUo")],
  ] },
  { step: "4 · The handshake", note: "The interview went well.", picks: [
    ["photo-1758518730384-be3d205838e8", "Handshake after interview (now)", u("two-professionals-shaking-hands-across-a-table-jEpZNyFSQwQ")],
    ["photo-1758520144427-ddb02ac74e9d", "Two women shaking hands at a desk", u("two-women-shaking-hands-across-a-desk-9TF9pMrCFMo")],
    ["photo-1758519288905-38b7b00c1023", "Two men shaking hands at a table", u("two-businessmen-shaking-hands-across-a-table-lZXX-QVdyXY")],
    ["photo-1549923746-c502d488b3ea", "Two men smiling, shaking hands", u("two-men-facing-each-other-while-shake-hands-and-smiling-NbtIDoFKGO8")],
    ["photo-1686771416282-3888ddaf249b", "Man and woman shaking hands", u("a-man-and-a-woman-shaking-hands-in-front-of-a-laptop-qFSQFSmfZkA")],
    ["photo-1698047682091-782b1e5c6536", "Woman welcomed with a handshake", u("a-woman-shaking-hands-with-another-woman-sitting-at-a-table-IESB4iFVuzA")],
  ] },
  { step: "5 · The offer", note: "You got the job: calm, confident joy.", picks: [
    ["photo-1758518731027-78a22c8852ec", "Man celebrating at laptop (now)", u("man-celebrating-success-while-looking-at-laptop-1hHv-8Ki378")],
    ["photo-1758599543118-538bba233399", "Man celebrating outside the office", u("man-celebrating-success-outside-modern-office-building-bgCiui1c90Q")],
    ["photo-1758599543110-f9cf3903a2ad", "Two people celebrating outside the office", u("two-business-people-celebrating-outside-modern-office-building-2c2COqctKmw")],
    ["photo-1782789082219-1c8d82297c37", "Smiling man in a suit", u("a-smiling-man-in-a-suit-against-a-dark-curtain-rN583GaPkRg")],
    ["photo-1771898343647-bd979ad8cca5", "Smiling man, arms crossed", u("smiling-man-in-white-shirt-with-arms-crossed-VkdH0Eemwqs")],
    ["photo-1581065178047-8ee15951ede6", "Woman in black blazer smiling", u("woman-in-black-blazer-smiling-RIt88XBR3G0")],
    ["photo-1758691737605-69a0e78bd193", "Smiling woman with glasses in an office", u("a-smiling-woman-with-glasses-in-an-office-APjRQ59peUg")],
  ] },
];

// Numbers run on across the groups so the owner can reply with them.
const START = GROUPS.map((_, i) => GROUPS.slice(0, i).reduce((t, g) => t + g.picks.length, 0));

export default function HeroPreview() {
  return (
    <>
      <SiteHeader inApp={false} />
      <main className="wrap hp-pick">
        <h1>Pick the hero photos</h1>
        <p>Choose one photo for each step and send the numbers (for example 3, 12, 18, 24, 31). &quot;(now)&quot; marks the photo in use today.</p>
        {GROUPS.map((g, gi) => (
          <section key={g.step}>
            <h2>{g.step}</h2>
            <p>{g.note}</p>
            <div className="hp-grid">
              {g.picks.map(([id, label, page], pi) => {
                const n = START[gi] + pi + 1;
                return (
                  <figure key={id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(id)} alt={label} loading="lazy" />
                    <span className="hp-num">{n}</span>
                    <figcaption>{label} · <a href={page} target="_blank" rel="noopener noreferrer">Unsplash</a></figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
