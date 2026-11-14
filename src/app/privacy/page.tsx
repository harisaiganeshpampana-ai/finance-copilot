import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How CalmOwe collects, uses and protects your information, including financial data and AI processing.",
};

const CONTACT = "privacy@calmowe.com";

const sections: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <p>
        This Privacy Policy explains how CalmOwe (&quot;we&quot;, &quot;us&quot;) collects, uses, shares and protects
        information when you use our website, applications and services (the &quot;Service&quot;). Your financial data
        is sensitive, and we treat it that way. <strong>We do not sell your personal data.</strong>
      </p>
    ),
  },
  {
    id: "collect",
    title: "Information we collect",
    body: (
      <ul>
        <li>
          <strong>Account information:</strong> your name, email address and profile details you choose to provide.
        </li>
        <li>
          <strong>Financial data:</strong> with your permission, information from connected accounts, such as account
          names, balances and transactions. We never ask for or store your bank login password.
        </li>
        <li>
          <strong>Uploaded bank statements:</strong> the transactions, dates, balances, bank name and file name from
          statements you upload (PDF, Excel or CSV). We keep the extracted transactions, not the original file. If a PDF
          is password-protected, the password is used once to open it and is never stored.
        </li>
        <li>
          <strong>Copilot content:</strong> the questions you ask the AI Copilot and the answers it generates.
        </li>
        <li>
          <strong>Usage and device data:</strong> pages visited, features used, browser type, IP address and similar
          technical information used to operate and secure the Service.
        </li>
        <li>
          <strong>Payment information:</strong> handled by our payment processors. We do not store your full card
          number.
        </li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "How we use your information",
    body: (
      <ul>
        <li>To provide the Service, including dashboards, insights and Copilot answers.</li>
        <li>To calculate figures such as balances, totals and upcoming bills.</li>
        <li>To keep the Service secure, prevent fraud and abuse, and enforce our Terms.</li>
        <li>To improve and troubleshoot the Service.</li>
        <li>To communicate with you about your account, security, and important changes.</li>
        <li>To comply with legal obligations.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <>
        <p>
          When you ask the Copilot a question, we send your question, recent messages in the conversation, and the
          relevant financial context (for example balances, totals and transactions) to a third-party AI model provider
          to generate a response. Depending on availability, this may include providers such as Google (Gemini), OpenAI
          and DeepSeek.
        </p>
        <p>
          When you upload a bank statement, CalmOwe first reads it with its own built-in reader. Only if that reader
          can&apos;t understand your bank&apos;s layout, the statement&apos;s text is sent to one of these AI providers to
          find the transactions. We check every transaction the AI returns against the statement itself.
        </p>
        <ul>
          <li>We send only the information needed to answer your question.</li>
          <li>
            AI providers process this data under their own terms and privacy policies. Where providers offer options
            that limit data retention or exclude customer data from model training, we aim to use them.
          </li>
          <li>We do not use your financial data for advertising.</li>
          <li>
            AI answers are informational only and are not official financial advice. See our{" "}
            <Link href="/terms">Terms of Service</Link>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    title: "Financial data security",
    body: (
      <>
        <p>We use safeguards designed to protect your information, including:</p>
        <ul>
          <li>Encryption of data in transit (TLS/HTTPS) and encryption of stored data at rest.</li>
          <li>
            <strong>Read-only</strong> account connections through third-party data providers. CalmOwe cannot move money.
          </li>
          <li>API keys and credentials kept on our servers and never exposed in your browser.</li>
          <li>Server-side validation of requests, access controls and monitoring.</li>
        </ul>
        <p>
          No system is completely secure. If we learn of a security incident affecting your personal data, we will
          notify you and the relevant authorities as required by law.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "How we share information",
    body: (
      <>
        <p>We share information only as needed to run the Service:</p>
        <ul>
          <li>
            <strong>Service providers</strong> that host, process or support the Service, such as cloud hosting, AI model
            providers, financial data providers and payment processors, under contracts that limit their use of your data.
          </li>
          <li>
            <strong>Legal reasons:</strong> when required by law, or to protect the rights, safety and security of our
            users and the Service.
          </li>
          <li>
            <strong>Business transfers:</strong> in connection with a merger, acquisition or sale of assets, subject to
            this Policy.
          </li>
        </ul>
        <p>We do not sell your personal data or share it with third parties for their own advertising.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "Data retention",
    body: (
      <p>
        We keep personal data for as long as your account is active or as needed to provide the Service, then delete or
        anonymize it unless we must keep it to meet legal, tax or regulatory obligations. You can disconnect financial
        accounts at any time, and you can ask us to delete your account.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights and choices",
    body: (
      <>
        <p>
          Depending on where you live (for example under the EU/UK GDPR, India&apos;s Digital Personal Data Protection
          Act, 2023, or California law), you may have the right to:
        </p>
        <ul>
          <li>Access the personal data we hold about you and receive a copy.</li>
          <li>Correct inaccurate data.</li>
          <li>Delete your data or account.</li>
          <li>Withdraw consent, for example by disconnecting a financial account.</li>
          <li>Object to or restrict certain processing, and raise a complaint with a data protection authority.</li>
        </ul>
        <p>
          To exercise these rights, contact <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <p>
        We use essential cookies and your browser&apos;s local storage to keep the Service working, for example to
        remember your display currency and preferences. We do not use advertising cookies.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        The Service is not intended for anyone under 18, and we do not knowingly collect personal data from children. If
        you believe a child has provided us data, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Our service providers may process data in countries other than where you live. When we transfer personal data
        internationally, we use appropriate safeguards as required by applicable law.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. If we make material changes, we will notify you through the
        Service or by email before they take effect. The &quot;Last updated&quot; date at the top shows when it last
        changed.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions or requests about your privacy? Contact us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          CalmOwe helps you manage money, so we hold ourselves to a high standard with your data. This policy explains
          what we collect, how we use it, how AI processing works, and the choices you have.
        </p>
      }
      sections={sections}
    />
  );
}
