import type { Metadata } from "next";
import { Anton, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Million Dollar T-Shirt — The World's Most Expensive T-Shirt",
    template: "%s — Million Dollar T-Shirt",
  },
  description:
    "Every pixel is an auction. Buy space on a real shirt, promote your brand, and become part of internet history.",
  authors: [{ name: "Million Dollar T-Shirt" }],
  openGraph: {
    title: "Million Dollar T-Shirt",
    description:
      "Every pixel is an auction. Buy space on a real shirt, promote your brand, and become part of internet history.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Million Dollar T-Shirt",
    description: "Every pixel is an auction.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${ibmPlexSans.variable}`}>
      <body className="bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
