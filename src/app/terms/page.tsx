import Link from "next/link";
import { LegalPage, SUPPORT_EMAIL } from "../legal/LegalPage";

export const metadata = { title: "Terms of Service", description: "The terms for using JobPao, your personal job assistant." };

export default function Terms() {
  return (
    <LegalPage title={<>Terms of <span>Service</span></>} sub="The rules for using JobPao, in plain words.">
      <h2>1. What JobPao is</h2>
      <p>JobPao (&quot;we&quot;, &quot;us&quot;) is an online job assistant at jobpao.app. It finds jobs that match your CV, writes a tailored CV and cover letter for each job, tracks your applications and helps you prepare for interviews. JobPao is software for job seekers: we do not sell job postings or advertising, and we do not charge employers. JobPao is run by Anwar Jahid, a sole proprietor based in Bangladesh. By creating an account you agree to these terms.</p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 16 years old and give a real email address.</li>
        <li>Keep your login safe. You are responsible for what happens in your account.</li>
        <li>One person, one account. Do not share an account or open extra accounts to get more free trials.</li>
      </ul>

      <h2>3. Your information must be true</h2>
      <p>JobPao builds your documents only from what you give us. Do not add qualifications, skills or jobs you do not have. Our AI is told never to invent facts, but you must read every CV, cover letter and message before you send it, because you are the one applying.</p>

      <h2>4. Applications</h2>
      <ul>
        <li>Nothing is sent to an employer without your approval. You apply yourself on the employer&apos;s site, or through your own Gmail if you connect it.</li>
        <li>We never ask for your passwords to job sites such as Bdjobs or LinkedIn.</li>
        <li>We cannot promise interviews or job offers. Hiring decisions are made by employers.</li>
        <li>Job listings come from public sources and employers. We check them, but cannot guarantee that every listing is accurate or still open.</li>
      </ul>

      <h2>5. Free trial and Pro</h2>
      <ul>
        <li>New accounts get a 5-day free trial with one application a day. No card is needed.</li>
        <li>Pro is a one-off payment for a fixed period (15 days, 30 days, 3 months or 1 year). It does not renew automatically and you are never charged again unless you buy another pack.</li>
        <li>Prices are shown on the <Link href="/#pricing">pricing section</Link> before you pay. The price depends on the country you live in.</li>
        <li>In Bangladesh you pay with bKash. Elsewhere you pay by card through Creem (creem.io), our reseller and Merchant of Record for all card orders, which handles the payment, receipt and any sales tax.</li>
        <li>Plans include fair-use limits on applications and AI use, shown in the app, so the service stays fast and affordable for everyone.</li>
        <li>Refunds follow our <Link href="/refund">Refund Policy</Link>.</li>
      </ul>

      <h2>6. Acceptable use</h2>
      <p>Do not misuse JobPao: no spam or mass applications, no attempts to break, overload or get around the service&apos;s limits, no scraping, and no use for anything illegal. We may suspend accounts that do, and refund any unused paid time where the law requires it.</p>

      <h2>7. Your content</h2>
      <p>Your CV, documents and details stay yours. You give us permission to store and process them only to run the service for you. Our <Link href="/privacy">Privacy Policy</Link> explains how. You can delete your account and data at any time from your Profile.</p>

      <h2>8. Availability and liability</h2>
      <p>We work hard to keep JobPao running and accurate, but it is provided &quot;as is&quot;. To the extent the law allows, we are not liable for indirect losses, lost opportunities or decisions made by employers, and our total liability is limited to the amount you paid us in the last 12 months. Nothing here limits rights you have under consumer law.</p>

      <h2>9. Changes</h2>
      <p>We may update these terms. If a change is important we will tell you by email or in the app before it applies. If you keep using JobPao after that, the new terms apply.</p>

      <h2>10. Contact</h2>
      <p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. These terms are governed by the laws of Bangladesh, without taking away any protection the law of your own country gives you.</p>
    </LegalPage>
  );
}
