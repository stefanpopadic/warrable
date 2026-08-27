import type { Metadata } from "next";
import Link from "next/link";
import { LegalH2, LegalPage, LegalP, LegalUl } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing Million Dollar T-Shirt purchases, placements, and use of the service.",
};

const EFFECTIVE = "Effective August 28, 2026. Last updated August 28, 2026.";

export default function TermsPage() {
  return (
    <LegalPage title="TERMS OF SERVICE" effective={EFFECTIVE}>
      <section>
        <LegalP>
          These Terms of Service (&quot;Terms&quot;) govern access to and use of Million Dollar T-Shirt
          (the &quot;Service&quot;), including the public artboard, product pages, checkout, and related
          features. By using the Service, creating a placement, or completing a payment, you agree to
          these Terms and to our{" "}
          <Link href="/privacy" className="text-foreground underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </LegalP>
        <LegalP>
          If you do not agree, do not use the Service and do not pay for a placement. Before checkout you
          must confirm, by checking a box, that you have read and agree to these Terms.
        </LegalP>
      </section>

      <section>
        <LegalH2>Operator and contact</LegalH2>
        <LegalP>
          The Service is operated by Stefan Popadic, an individual (&quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;). The Service is provided from https://1milliondollartshirt.com.
        </LegalP>
        <LegalUl>
          <li>
            Legal and listing notices:{" "}
            <a href="mailto:stefan@popadic.co" className="text-foreground underline underline-offset-2">
              stefan@popadic.co
            </a>
          </li>
        </LegalUl>
        <LegalP>
          These Terms work together with the public{" "}
          <Link href="/rules" className="text-foreground underline underline-offset-2">
            Rules
          </Link>
          . If the Rules and these Terms conflict, these Terms control.
        </LegalP>
      </section>

      <section>
        <LegalH2>What the Service is</LegalH2>
        <LegalP>
          Million Dollar T-Shirt is a paid public pixel auction on a digital artboard that will be printed
          on a physical T-shirt. You may pay to reserve free space, upload a logo, and link a brand
          website, according to the Rules. Placements are paid advertisements, not editorial reviews,
          certifications, endorsements, or independent rankings.
        </LegalP>
        <LegalP>
          A payment buys confirmed space on the artboard at the time it is fulfilled, and inclusion in the
          printed shirt when the auction closes. It does not buy traffic, clicks, customers, revenue,
          search-engine ranking, a fixed number of impressions, or any particular commercial result. We
          may change, pause, or discontinue features, including pricing tiers, reservation windows, and
          display formats.
        </LegalP>
      </section>

      <section>
        <LegalH2>Eligibility</LegalH2>
        <LegalUl>
          <li>You must be at least 18 years old and able to form a binding contract.</li>
          <li>
            If you use the Service for a company, you represent that you have authority to bind that
            company, and &quot;you&quot; includes that company.
          </li>
          <li>
            You may not use the Service if you are prohibited from receiving services under the laws of
            the United States, the European Union, Serbia, or another applicable jurisdiction, including
            trade sanctions.
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>Payments, Stripe, and taxes</LegalH2>
        <LegalP>
          Checkout is processed by Stripe. We do not collect or store full payment-card numbers.
          Stripe&apos;s terms and privacy notice also apply to the payment itself. Amounts are priced in
          US dollars. Applicable taxes may be added at checkout.
        </LegalP>
        <LegalP>
          Pixel prices, minimums, tier changes, and reservation timing are described in the Rules and
          shown before you pay. Completing checkout is an offer to buy placement on those terms. Space is
          assigned when payment is confirmed and the placement is written to the artboard.
        </LegalP>
      </section>

      <section>
        <LegalH2>No refunds</LegalH2>
        <LegalP>
          All payments are final and not refundable. Placement is a digital service that begins as soon
          as payment is confirmed: the listing is created on the public artboard, and the paid amount is
          counted toward pixels sold. Fewer clicks than you hoped for, dissatisfaction with the printed
          shirt, downtime, or a later removal for breach of these Terms does not create a refund.
        </LegalP>
        <LegalP>
          By completing checkout you request that we start this digital service immediately and
          acknowledge that you lose any statutory right of withdrawal or cooling-off period to the extent
          that law allows that waiver. Where a mandatory consumer right cannot be waived, we honor that
          right. Chargebacks, payment disputes, or reversed payments without a legally required basis are
          a breach of these Terms; we may remove the placement and refuse future use of the Service.
        </LegalP>
      </section>

      <section>
        <LegalH2>Listings must have valid company details</LegalH2>
        <LegalP>
          You may only list a website that you own or are authorized to represent. The live site should
          display valid, current company or operator details that identify who is legally responsible for
          that project: legal name and, where the law that applies to that site requires it, a postal
          address, a working contact method, and any other required imprint, business-register, or tax
          information.
        </LegalP>
        <LegalP>
          Details that are missing, fake, incomplete, impersonating someone else, or that we cannot
          reasonably verify are grounds for removal. We may take down a placement at any time if those
          details are not in order, without refund.
        </LegalP>
      </section>

      <section>
        <LegalH2>Your warranties</LegalH2>
        <LegalP>By submitting a logo, URL, brand name, or payment, you represent and warrant that:</LegalP>
        <LegalUl>
          <li>You have the right to list that destination and to send visitors there.</li>
          <li>
            The listing, artwork, and destination comply with all applicable laws, including advertising,
            consumer, privacy, intellectual-property, and regulated-industry rules.
          </li>
          <li>
            You are not impersonating another person, brand, or company, and you are not claiming space
            for a competitor&apos;s site without authorization.
          </li>
          <li>
            The destination is not malware, phishing, a scam, or a site whose primary purpose is to
            deceive visitors.
          </li>
          <li>The information and artwork you submit are accurate, and you will keep them accurate.</li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>Prohibited listings and use</LegalH2>
        <LegalP>In addition to the Rules, you may not list or use the Service for:</LegalP>
        <LegalUl>
          <li>
            Sexual, pornographic, or adult-platform content; chat, invite, or messaging-group links
            (Telegram, WhatsApp, Discord, and similar); or link shorteners used to hide the real
            destination.
          </li>
          <li>
            Content that is illegal, fraudulent, defamatory, harassing, hateful, violent, or that
            exploits children.
          </li>
          <li>
            Counterfeit goods, unauthorized streaming, or other infringement of copyright, trademark, or
            other rights.
          </li>
          <li>
            Offers that require licenses you do not have (including certain financial, medical, gambling,
            or weapons-related offers).
          </li>
          <li>
            Interfering with the Service: scraping beyond ordinary browsing, manipulating click counts,
            bypassing rate limits, automated purchases without our written permission, or reverse
            engineering except as allowed by mandatory law.
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>Our right to remove listings</LegalH2>
        <LegalP>
          We may refuse, delay, edit, hide, or permanently remove any placement, logo, or related page,
          with or without notice, including where we believe these Terms, the Rules, or the law may have
          been broken; where a rights holder or a platform complains; where company details are missing
          or invalid; or where we think the listing creates legal, security, or reputational risk.
          Removal does not entitle you to a refund.
        </LegalP>
      </section>

      <section>
        <LegalH2>Fair use and third-party content</LegalH2>
        <LegalP>
          To run the board we display information you submit and may fetch publicly available metadata
          about listed destinations: names, titles, descriptions, logos, and favicons. We use that
          material only to identify the listed brand on Million Dollar T-Shirt, to show visitors where a
          paid placement leads, and to operate, moderate, and improve the Service.
        </LegalP>
        <LegalP>
          Where United States law applies, that display is intended as nominative fair use of trademarks
          and as fair use of copyrighted material: we use only what is needed to identify the destination,
          we do not use it as our own brand, and we do not suggest sponsorship or endorsement by the
          rights holder unless the lister is that rights holder.
        </LegalP>
        <LegalP>
          Million Dollar T-Shirt, our wordmark, and the look of the Service are ours. You may not copy
          the Service, scrape the board for a competing product, or use our brand in a way that suggests
          we endorse you. Stripe and other third-party names remain their owners&apos; property.
        </LegalP>
      </section>

      <section>
        <LegalH2>License you grant us</LegalH2>
        <LegalP>
          You grant us a worldwide, non-exclusive, royalty-free license to host, cache, reproduce, adapt
          (for sizing, formatting, print, and display), and publicly display the listing, logo, and
          related metadata, for as long as needed to operate, promote, print, photograph, document, and
          keep an archive of the Service — including on the physical shirt and in related content. You
          also grant visitors a right to see that listing on the Service. If you want a listing taken
          down, email{" "}
          <a href="mailto:stefan@popadic.co" className="text-foreground underline underline-offset-2">
            stefan@popadic.co
          </a>
          . Takedown does not undo a completed payment and may not reverse a shirt already printed.
        </LegalP>
      </section>

      <section>
        <LegalH2>Complaints and rights notices</LegalH2>
        <LegalP>
          If you believe a listing infringes your copyright, trademark, publicity, or other rights, or
          that a listed site is unlawful, email{" "}
          <a href="mailto:stefan@popadic.co" className="text-foreground underline underline-offset-2">
            stefan@popadic.co
          </a>{" "}
          with: (1) your name and contact details; (2) the placement or page on Million Dollar T-Shirt;
          (3) the destination URL; (4) a description of the problem; and (5) a statement that the notice
          is accurate and that you are the rights holder or authorized to act. We may remove or restrict
          the listing while we review the notice. We may share the notice with the lister. Repeat or
          abusive notices may be ignored.
        </LegalP>
      </section>

      <section>
        <LegalH2>No endorsement, no earnings claims</LegalH2>
        <LegalP>
          Appearance on the artboard or shirt is not our opinion of a product. We do not verify that
          listed companies, claims, prices, or results are true. Click or visitor counts describe what
          our systems recorded; they are not a promise that you will get the same outcome. Your results
          depend on your placement, your destination, timing, and factors we do not control.
        </LegalP>
        <LegalP>
          Links from the Service to listed sites leave Million Dollar T-Shirt. Those destinations have
          their own terms and practices. We are not responsible for them.
        </LegalP>
      </section>

      <section>
        <LegalH2>Availability and changes</LegalH2>
        <LegalP>
          We provide the Service as-is. It may be unavailable, slow, or incorrect. We may change pricing
          rules, minimums, reservation windows, or these Terms. If a change is material, we will update
          the date at the top of this page. Continued use after a change means you accept the new Terms.
          For a payment already completed, the Terms in effect at checkout still apply to that payment,
          except where a change is required by law or needed to address a security or legal risk.
        </LegalP>
      </section>

      <section>
        <LegalH2>Disclaimers</LegalH2>
        <LegalP>
          To the fullest extent permitted by law, we disclaim all warranties, express or implied,
          including merchantability, fitness for a particular purpose, quiet enjoyment, and
          non-infringement. We do not warrant that the Service will be uninterrupted, secure, or free of
          errors, or that listings, names, images, pixel counts, or click counts are accurate or
          complete.
        </LegalP>
      </section>

      <section>
        <LegalH2>Limitation of liability</LegalH2>
        <LegalP>
          We do not limit liability that applicable law says we cannot limit, including liability for
          intent, gross negligence, injury to life, body, or health, or liability under mandatory
          product-liability rules. Subject to that:
        </LegalP>
        <LegalUl>
          <li>
            We are not liable for lost profits, lost data, lost goodwill, substitute services, or other
            indirect, incidental, special, or consequential damages.
          </li>
          <li>
            For slight negligence, we are liable only for a foreseeable breach of duties that are
            essential to these Terms, and only for typical, foreseeable damage.
          </li>
          <li>
            Our total liability for a claim relating to a payment is limited to the amount you paid us
            for the placement that the claim concerns in the three months before the claim.
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>Indemnity</LegalH2>
        <LegalP>
          You will defend, indemnify, and hold harmless Stefan Popadic and people working on the Service
          from claims, damages, losses, and reasonable legal fees arising out of your listing, your
          artwork, your destination site, your payment or chargeback, your breach of these Terms, or
          your infringement of someone else&apos;s rights. We may take over the defense of a claim; you
          will cooperate.
        </LegalP>
      </section>

      <section>
        <LegalH2>Governing law</LegalH2>
        <LegalP>
          These Terms are governed by the laws of the United States of America and the State of Texas,
          excluding conflict-of-law rules. If you are a consumer with a mandatory local law that cannot
          be displaced, that law still protects you. If you are not a consumer, courts in Travis County,
          Texas have exclusive jurisdiction, to the extent permitted.
        </LegalP>
      </section>

      <section>
        <LegalH2>General</LegalH2>
        <LegalUl>
          <li>
            If a part of these Terms is unenforceable, the rest remains in effect, and the invalid part
            is replaced by the valid term that comes closest to the original intent.
          </li>
          <li>
            Our failure to enforce a provision is not a waiver. You may not assign these Terms without
            our consent; we may assign them in connection with a transfer of the Service.
          </li>
          <li>
            These Terms, the Rules, the Privacy Policy, and the checkout details you confirm form the
            entire agreement for the Service.
          </li>
          <li>
            Payments, hosting, storage, and analytics involve third parties, including Stripe, Vercel,
            and Postgres providers. Their outages or decisions are outside our control.
          </li>
        </LegalUl>
        <LegalP>
          Questions:{" "}
          <a href="mailto:stefan@popadic.co" className="text-foreground underline underline-offset-2">
            stefan@popadic.co
          </a>
          .
        </LegalP>
      </section>
    </LegalPage>
  );
}
