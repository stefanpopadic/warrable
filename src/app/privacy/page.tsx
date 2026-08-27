import type { Metadata } from "next";
import Link from "next/link";
import { LegalH2, LegalPage, LegalP, LegalUl } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Million Dollar T-Shirt collects, uses, and shares information when you visit or buy space.",
};

const EFFECTIVE = "Effective August 28, 2026. Last updated August 28, 2026.";

export default function PrivacyPage() {
  return (
    <LegalPage title="PRIVACY POLICY" effective={EFFECTIVE}>
      <section>
        <LegalP>
          This Privacy Policy explains how Million Dollar T-Shirt (https://1milliondollartshirt.com)
          collects, uses, and shares information when you visit the site, click a placement, or pay for
          space. It sits alongside our{" "}
          <Link href="/terms" className="text-foreground underline underline-offset-2">
            Terms of Service
          </Link>
          .
        </LegalP>
      </section>

      <section>
        <LegalH2>Who is responsible</LegalH2>
        <LegalP>
          The controller for personal data processed through the Service is Stefan Popadic, an
          individual.
        </LegalP>
        <LegalUl>
          <li>
            Email:{" "}
            <a href="mailto:stefan@popadic.co" className="text-foreground underline underline-offset-2">
              stefan@popadic.co
            </a>
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>What we collect</LegalH2>
        <LegalP>
          We keep the Service small. We collect only what we need to run the artboard, take payment, stop
          abuse, and understand traffic.
        </LegalP>
        <LegalUl>
          <li>
            <strong className="text-foreground">Checkout and listing data.</strong> The brand name,
            website URL, logo file, selected region or pixel amount, and payment confirmation identifiers
            from Stripe (checkout and payment IDs) so we can place your space on the board.
          </li>
          <li>
            <strong className="text-foreground">Payment data.</strong> Card details and billing identity
            are collected by Stripe, not by us. Stripe may send us confirmation that you paid and an
            amount. See Stripe&apos;s own privacy notice.
          </li>
          <li>
            <strong className="text-foreground">Clicks.</strong> When you visit a listing from the
            artboard, we may record the placement, a time, and limited technical signals (for example a
            hashed IP address) for rate limiting and fake-click reduction, not to profile you.
          </li>
          <li>
            <strong className="text-foreground">Site stats.</strong> Aggregate visit counts and related
            operational metrics may be stored so we can show public stats and keep the Service reliable.
          </li>
          <li>
            <strong className="text-foreground">Technical data.</strong> Standard request data such as
            user agent, referrer, and IP address may be processed by our host to operate and secure the
            Service.
          </li>
          <li>
            <strong className="text-foreground">Messages you send us.</strong> If you email a notice or a
            privacy request, we keep that correspondence as needed to respond and to keep a legal record.
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>Cookies</LegalH2>
        <LegalP>
          We may use strictly necessary cookies or similar storage so checkout and basic site features
          work. We do not use them for advertising networks. Your browser may also store local preferences
          for the page.
        </LegalP>
      </section>

      <section>
        <LegalH2>Why we use this data</LegalH2>
        <LegalUl>
          <li>
            <strong className="text-foreground">Contract.</strong> To take payment, create a placement,
            show it on the artboard, print the shirt, and provide the Service you asked for.
          </li>
          <li>
            <strong className="text-foreground">Legitimate interests.</strong> To keep the board fair
            (rate limits, bot filtering), display public listing metadata, measure visits, debug outages,
            and defend legal claims. You may object to processing based on legitimate interests as
            described below.
          </li>
          <li>
            <strong className="text-foreground">Legal obligation.</strong> To keep tax, accounting, and
            complaint records where the law requires it.
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>Public listings</LegalH2>
        <LegalP>
          Brand names, logos, pixel amounts, and destination links on the artboard are public. Anyone can
          see them, including search engines. Do not list a destination if you do not want that
          information shown. We may fetch public metadata from the site you submit so visitors can
          recognize the listing. That fetch may disclose to the destination that Million Dollar T-Shirt
          requested the page.
        </LegalP>
      </section>

      <section>
        <LegalH2>Who we share data with</LegalH2>
        <LegalUl>
          <li>Stripe — checkout and payment confirmation.</li>
          <li>
            Hosting, database, file storage, and edge infrastructure (currently including Vercel, Postgres
            / Neon, and blob storage) so the site can run.
          </li>
          <li>
            Professional advisers, authorities, or a buyer of the Service if we must share data to comply
            with law, enforce the Terms, or transfer the project.
          </li>
        </LegalUl>
        <LegalP>
          We do not sell your personal data. Some processors may be outside the European Economic Area.
          Where we rely on them, we use appropriate safeguards such as the processors&apos; standard
          contractual clauses or an equivalent mechanism they provide.
        </LegalP>
      </section>

      <section>
        <LegalH2>How long we keep it</LegalH2>
        <LegalUl>
          <li>
            Public placements stay while they are on the artboard and may remain in backups, print files,
            photographs, or activity history after a takedown for a limited time.
          </li>
          <li>
            Payment identifiers and amounts are kept as long as needed for accounting, tax, fraud, and
            dispute handling.
          </li>
          <li>
            Click records and technical hashes are kept only as long as useful for rate limiting, abuse
            prevention, and aggregate counts.
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>Your rights</LegalH2>
        <LegalP>
          If the GDPR or similar law applies to you, you may ask us to access, correct, delete, or export
          personal data we hold about you, to restrict or object to certain processing, and to withdraw
          consent where processing was based on consent. You may also lodge a complaint with a supervisory
          authority in your country of residence.
        </LegalP>
        <LegalP>
          Email{" "}
          <a href="mailto:stefan@popadic.co" className="text-foreground underline underline-offset-2">
            stefan@popadic.co
          </a>
          . We may need enough information to find your data. Public listing content that is also on your
          own website is not made private just by appearing on the board; you can ask us to remove the
          listing.
        </LegalP>
      </section>

      <section>
        <LegalH2>Children</LegalH2>
        <LegalP>
          The Service is for adults. We do not knowingly collect personal data from children. If you
          believe a child has used the Service, contact us and we will delete the data we can identify.
        </LegalP>
      </section>

      <section>
        <LegalH2>Changes</LegalH2>
        <LegalP>
          We may update this policy when the Service or the law changes. The date at the top of this page
          is the current version. If a change is material, we will post the updated policy here.
        </LegalP>
      </section>
    </LegalPage>
  );
}
