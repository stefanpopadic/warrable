import type { Metadata } from "next";
import Link from "next/link";
import { LegalH2, LegalPage, LegalP, LegalUl } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Rules",
  description:
    "How Million Dollar T-Shirt works: pricing, placement, payments, and what you can list.",
};

export default function RulesPage() {
  return (
    <LegalPage title="RULES">
      <section>
        <LegalP>
          Million Dollar T-Shirt is a paid public artboard. There are no ads networks, no API keys, and
          no revenue share. You pay for printed pixel space on a real T-shirt. Space is what you pay for —
          nothing else.
        </LegalP>
      </section>

      <section>
        <LegalH2>The board</LegalH2>
        <LegalP>
          The live artboard shows every confirmed placement. Once Stripe confirms payment, the pixels you
          bought are yours: nobody can take them, shrink them, or buy them out from under you. Version one
          sells only free space — no takeover auctions for pixels somebody already owns.
        </LegalP>
        <LegalP>
          The board arranges itself. Logos are laid out by amount paid, so the biggest buyer sits closest
          to the center and everyone else clusters around it. That means your position on the shirt can
          shift as other people buy, as buyers grow their logos, and as new milestones unlock more space.
          Your pixel count is fixed; where those pixels sit is not.
        </LegalP>
      </section>

      <section>
        <LegalH2>How pricing works</LegalH2>
        <LegalUl>
          <li>
            Pricing starts at <strong className="text-foreground">$0.25 per printed pixel</strong> and
            doubles every 100,000 pixels sold. Large purchases are split across tiers automatically.
          </li>
          <li>
            Minimum purchase is <strong className="text-foreground">100 printed pixels</strong>. The
            exact total is shown before you pay.
          </li>
          <li>
            Amounts are in US dollars. Applicable taxes may be added at checkout by Stripe.
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>How placement works</LegalH2>
        <LegalUl>
          <li>
            You choose an amount, not a position. Your spend sets how many pixels you get, and your logo
            is sized to keep its own proportions.
          </li>
          <li>
            The board is then packed by amount paid, largest first, so the leader holds the center. The
            preview on the shirt shows exactly where you will land before you pay.
          </li>
          <li>
            Already own a spot? Click your logo and add more pixels. You pay only for what you add, at
            the current price per pixel, and the extra is added to your existing total.
          </li>
          <li>
            Checkout reserves your space for about 30 minutes. If payment is not completed in time, the
            reservation expires and the space returns to the pool.
          </li>
          <li>
            A completed payment is what claims the space. Your creative goes live only after payment is
            confirmed.
          </li>
          <li>Payments are not refundable.</li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>What you can list</LegalH2>
        <LegalUl>
          <li>A brand logo plus a product website you own or are authorized to represent.</li>
          <li>
            Chat and invite links are not allowed — Telegram, WhatsApp, Discord, Messenger, Signal, and
            similar. The board is for brands and products, not group chats.
          </li>
          <li>
            Links to sexual content are not allowed. If it is porn, NSFW, or an adult platform, it does
            not belong on the board.
          </li>
          <li>
            Query parameters may be stripped from listing links. Affiliate, referral, and tracking URLs
            may not work as submitted.
          </li>
          <li>
            Link shortener URLs are not allowed. If you submit one, it may be replaced by the URL it
            redirects to, or rejected.
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>Artwork</LegalH2>
        <LegalUl>
          <li>Upload a square or rectangular PNG, JPG, or WebP logo up to 4 MB.</li>
          <li>Transparent PNGs stay transparent; photographs fill the selected region.</li>
          <li>
            You must have the rights to use the artwork you upload. We may resize or crop it to fit the
            purchased region.
          </li>
        </LegalUl>
      </section>

      <section>
        <LegalH2>After you pay</LegalH2>
        <LegalUl>
          <li>
            Your placement is public on the digital artboard. Clicks may go to the website you submitted.
          </li>
          <li>
            When the auction closes, the artboard is locked, exported at print resolution, and printed
            edge-to-edge on the back of a black shirt. Buyers get the final artwork file.
          </li>
          <li>
            Paying means you agree to the{" "}
            <Link href="/terms" className="text-foreground underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-foreground underline underline-offset-2">
              Privacy Policy
            </Link>
            , including the requirement that listed projects show valid company details.
          </li>
        </LegalUl>
      </section>
    </LegalPage>
  );
}
