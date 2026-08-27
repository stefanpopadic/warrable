import type { Metadata } from "next";
import { AboutPage } from "@/components/about-page";

export const metadata: Metadata = {
  title: "About",
  description:
    "What is Million Dollar T-Shirt? The internet billboard becomes a real wearable billboard.",
};

export default function Page() {
  return <AboutPage />;
}
