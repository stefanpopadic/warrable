# 1MillionDollarTShirt

Rebuild of the Lovable **Wearable Billboard** project as a real GitHub app.

Brands bid for visual space on a shared artboard. Larger bid = larger printed area. The finished board is printed onto a black T-shirt.

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **React 19**

Chosen because it is the portable GitHub/Vercel equivalent of the original Lovable TanStack Start app: same UI, same auction interaction, no Lovable sandbox.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What is in the rebuild

- Split homepage: auction copy + live artboard
- Drag-to-claim pixels, zoom, logo upload, bid panel
- Leaderboard, documented “most expensive T-shirts” ranking, FAQ
- About page

Auction pricing: **$2.20 / pixel**, **100 px minimum**.
