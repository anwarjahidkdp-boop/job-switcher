import { LegalPage, SUPPORT_EMAIL, UK_REPRESENTATIVE } from "../legal/LegalPage";

export const metadata = { title: "Privacy Policy", description: "What JobPao collects, why, and how you control it." };

export default function Privacy() {
  return (
    <LegalPage title={<>Privacy <span>Policy</span></>} sub="What we collect, why, and how you stay in control.">
      <h2>The short version</h2>
      <ul>
        <li>We use your information only to find jobs for you and prepare your applications.</li>
        <li>Your CV is private. It is never public and never sold.</li>
        <li>We never ask for your job-site passwords.</li>
        <li>You can delete everything at any time from your Profile.</li>
      </ul>

      <h2>Who we are</h2>
      <p>JobPao is run by Anwar Jahid, trading as YourTech AI, a sole proprietor based in Bangladesh, who is responsible for your data (the &quot;controller&quot;). Contact: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> your email address and login details.</li>
        <li><b>Career details:</b> your CV (text, and the file or photo you upload), work history, education, skills, job preferences, target country and the country you live in.</li>
        <li><b>Your activity:</b> jobs you save or dismiss, applications and their status, interview notes, and job-alert emails you choose to forward to your JobPao address.</li>
        <li><b>Payments:</b> the pack, amount, date and payment reference. Card numbers go straight to Creem, our payment reseller, and we never see them. For bKash we keep the transaction ID you enter.</li>
        <li><b>Gmail (only if you connect it):</b> permission to send emails you approve. We cannot read your inbox.</li>
        <li><b>Technical data:</b> your approximate country from your IP address (to suggest prices and job markets), and basic logs to keep the service secure.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To match you with jobs and write tailored CVs, cover letters and interview preparation.</li>
        <li>To send you account emails, reminders and alerts you can turn off in the app.</li>
        <li>To take payments, prevent abuse and keep the service secure.</li>
      </ul>
      <p>We process this information to provide the service you asked for (our contract with you), and for our legitimate interest in keeping JobPao safe. We do not use your data for advertising and we do not sell it.</p>

      <h2>Who helps us run JobPao</h2>
      <p>We share data only with the service providers we need, each bound to protect it:</p>
      <ul>
        <li><b>Supabase</b>: database, file storage and login.</li>
        <li><b>Cloudflare</b>: website hosting and receiving forwarded emails.</li>
        <li><b>Anthropic</b>: the AI that reads your CV and job posts to write your documents. Data sent through its API is not used to train its models.</li>
        <li><b>Creem</b> (card payments, as Merchant of Record) and <b>bKash</b> (Bangladesh payments).</li>
        <li><b>Email providers</b> (such as Brevo) to deliver our emails, and <b>Google</b> if you connect Gmail.</li>
      </ul>
      <p>Some of these providers process data outside your country. Our database is hosted by Supabase in South Korea, the AI runs with Anthropic in the United States, and Cloudflare serves the site from the data centre nearest to you. Where data leaves the UK or EU, these providers use the approved safeguards for international transfers, such as the UK International Data Transfer Addendum and the EU Standard Contractual Clauses.</p>

      <h2>Match scores and AI</h2>
      <p>The AI scores how well each job fits your CV and drafts your documents. These scores only help you choose: nothing is sent to an employer and no decision about you is made without you. You can ignore any score, edit every document, and ask us to check a score by email.</p>

      <h2>Employers</h2>
      <p>Your CV and cover letter go to an employer only when you apply to that job yourself.</p>

      <h2>Cookies</h2>
      <p>We use only the cookies needed to keep you signed in and to remember basic settings. There are no advertising or tracking cookies.</p>

      <h2>How long we keep it</h2>
      <p>We keep your data while your account is open. When you delete your account, your CVs, photo, profile, applications and forwarded emails are deleted straight away. Encrypted backups are kept for up to 90 days and then removed. Payment records are kept as long as tax law requires, without your CV or profile.</p>

      <h2>Your rights</h2>
      <p>You can see and edit your details in the app, download your documents, and delete your account from your Profile. You can also ask us to access, correct, export or delete your data, or object to how we use it, by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We reply within one month.</p>
      <p>If you are in the UK, you can complain to the Information Commissioner&apos;s Office (ICO) at <a href="https://ico.org.uk/make-a-complaint/" rel="noopener noreferrer" target="_blank">ico.org.uk/make-a-complaint</a> or on 0303 123 1113. If you are in the EU, you can complain to the data protection authority where you live. We would be grateful for the chance to put things right first.</p>
      {UK_REPRESENTATIVE && <p>Because we are based outside the UK, we have a representative in the UK under Article 27 of the UK GDPR: {UK_REPRESENTATIVE}.</p>}

      <h2>Security</h2>
      <p>Data is encrypted in transit, each person can only reach their own records, and payment and email keys are kept as server secrets. No system is perfectly secure, so please tell us at once if you notice anything wrong.</p>

      <h2>Children</h2>
      <p>JobPao is not for anyone under 16.</p>

      <h2>Changes</h2>
      <p>If we change this policy in an important way, we will tell you by email or in the app first.</p>
    </LegalPage>
  );
}
