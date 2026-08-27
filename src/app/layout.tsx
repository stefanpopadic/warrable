import type { Metadata } from "next";
import { Anton, Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const barlow = Barlow({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Million Dollar T-Shirt — The World's Most Expensive T-Shirt",
    template: "%s — Million Dollar T-Shirt",
  },
  description:
    "Every pixel is an auction. Buy space on a real shirt, get your brand seen, and become part of internet history.",
  authors: [{ name: "Million Dollar T-Shirt" }],
  openGraph: {
    title: "Million Dollar T-Shirt",
    description:
      "Every pixel is an auction. Buy space on a real shirt, get your brand seen, and become part of internet history.",
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
    <html
      lang="en"
      className={`${anton.variable} ${barlow.variable} ${barlowCondensed.variable} ${jetbrains.variable}`}
    >
      <body className="bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
