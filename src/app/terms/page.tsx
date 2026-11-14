import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of CalmOwe.",
};

const CONTACT = "legal@calmowe.com";

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement to these terms",
    body: (
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the CalmOwe website, applications
        and related services (the &quot;Service&quot;). By creating an account or using the Service, you agree to these
        Terms and to our <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Service.
      </p>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility",
    body: (
      <p>
        You must be at least 18 years old and able to form a binding contract to use the Service. By using CalmOwe, you
        confirm that you meet these requirements.
      </p>
    ),
  },
  {
    id: "service",
    title: "The service",
    body: (
      <p>
        CalmOwe helps you understand your cash flow and prioritize debt repayment. It shows balances, income, spending
        and upcoming bills, and includes an AI assistant (the &quot;Copilot&quot;) that answers questions about your
        finances. Some features may be in early access, change over time, or be discontinued. We may add, change or
        remove features at any time.
      </p>
    ),
  },
  {
    id: "no-advice",
    title: "Not financial advice",
    body: (
      <>
        <p>
          <strong>
            CalmOwe does not provide official financial, investment, tax, legal or accounting advice.
          </strong>{" "}
          Information in the Service, including Copilot answers, is general information about cash flow, budgeting and
          debt prioritization, provided for educational and informational purposes only.
        </p>
        <ul>
          <li>CalmOwe is not a registered investment adviser, broker-dealer, bank, lender or financial planner.</li>
          <li>
            CalmOwe does not recommend buying, selling or holding any stock, fund, cryptocurrency or other security.
          </li>
          <li>
            You are solely responsible for your financial decisions. Consider consulting a qualified professional before
            making significant decisions.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI features",
    body: (
      <>
        <p>
          The Copilot uses artificial intelligence models provided by third parties to generate responses based on your
          questions and the financial information available in your account. To do this, your questions and relevant
          financial context are sent to those providers for processing, as described in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <p>
          AI-generated content can be inaccurate, incomplete or out of date. Always review Copilot answers and verify
          important figures against your own records before acting on them. Do not rely on the Copilot as your only
          source of information for financial decisions.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <p>
        You are responsible for keeping your login credentials confidential and for all activity under your account.
        Provide accurate information and keep it up to date. Notify us promptly at{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a> if you suspect unauthorized access.
      </p>
    ),
  },
  {
    id: "connected-accounts",
    title: "Connected financial accounts",
    body: (
      <>
        <p>
          You may choose to connect bank or other financial accounts. Connections are made through third-party data
          providers and give CalmOwe <strong>read-only</strong> access to information such as balances and
          transactions. CalmOwe cannot move money, make payments or initiate transfers from your accounts.
        </p>
        <p>
          The accuracy and timeliness of account data depend on your financial institution and our data providers. Your
          use of a data provider may also be subject to that provider&apos;s own terms. You can disconnect an account at
          any time.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Subscriptions and payments",
    body: (
      <>
        <p>
          Some features require a paid subscription. Prices, billing periods and plan features are shown on our{" "}
          <Link href="/pricing">Pricing page</Link> at the time of purchase. Prices exclude applicable taxes unless
          stated otherwise.
        </p>
        <ul>
          <li>Paid plans renew automatically at the end of each billing period until you cancel.</li>
          <li>You can cancel at any time; cancellation takes effect at the end of the current billing period.</li>
          <li>Except where required by law, payments are non-refundable.</li>
          <li>We may change prices with advance notice. Changes apply from your next billing period.</li>
        </ul>
        <p>Payments are processed by third-party payment processors. CalmOwe does not store your full card details.</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful, fraudulent or harmful purpose.</li>
          <li>Access accounts or data that are not yours, or connect accounts you are not authorized to access.</li>
          <li>Interfere with, overload, or attempt to gain unauthorized access to the Service or its systems.</li>
          <li>Reverse engineer, scrape or copy the Service, except as permitted by law.</li>
          <li>Use the Copilot to generate content that is illegal, abusive or misleading.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: (
      <p>
        The Service, including its software, design, text, graphics and the CalmOwe name and logo, is owned by CalmOwe
        and protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable license to
        use the Service for your personal use in accordance with these Terms.
      </p>
    ),
  },
  {
    id: "your-data",
    title: "Your data",
    body: (
      <p>
        You keep ownership of the data you provide or connect. You grant CalmOwe a limited license to process that data
        solely to operate, secure and improve the Service and as described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>. We do not sell your personal data.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent permitted by law,
        CalmOwe disclaims all warranties, express or implied, including warranties of merchantability, fitness for a
        particular purpose, accuracy and non-infringement. We do not guarantee that the Service will be uninterrupted,
        error-free, or that any information, including AI-generated content, is accurate or complete.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the fullest extent permitted by law, CalmOwe will not be liable for any indirect, incidental, special,
        consequential or punitive damages, or for any loss of profits, data, or financial losses resulting from
        decisions made using the Service. Our total liability for any claim relating to the Service is limited to the
        amount you paid us in the 12 months before the claim arose. Nothing in these Terms limits liability that cannot
        be limited under applicable law.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnification",
    body: (
      <p>
        You agree to indemnify and hold CalmOwe harmless from claims, losses and expenses (including reasonable legal
        fees) arising from your misuse of the Service or your violation of these Terms.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Suspension and termination",
    body: (
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or terminate your access if
        you violate these Terms or if needed to protect the Service or other users. Sections that by their nature should
        survive termination (including disclaimers and limitation of liability) will survive.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these Terms from time to time. If we make material changes, we will notify you through the
        Service or by email before they take effect. Continuing to use the Service after changes take effect means you
        accept the updated Terms.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These Terms are governed by the laws of the jurisdiction in which CalmOwe is established, without regard to
        conflict-of-law rules. This does not limit any mandatory consumer protection rights you have under the laws of
        the place where you live.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these Terms? Contact us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          Please read these terms carefully. They explain your rights and responsibilities when using CalmOwe,
          including important limits on what our AI Copilot does and does not provide.
        </p>
      }
      sections={sections}
    />
  );
}
