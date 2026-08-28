"use client";

import { QR_CODE_URL } from "@/lib/auction";

export function ShirtQRCode({ className = "" }: { className?: string }) {
  return (
    <a
      href={QR_CODE_URL}
      target="_blank"
      rel="noreferrer"
      title="Million Dollar T-Shirt — Official QR Code"
      aria-label="Million Dollar T-Shirt QR code, links to official project"
      className={`group absolute left-1/2 -translate-x-1/2 z-30 flex items-center justify-center transition-all duration-300 hover:scale-[1.12] hover:drop-shadow-[0_0_14px_rgba(255,255,255,0.35)] ${className}`}
      style={{
        top: "calc(11.5% + 40px)",
        width: "6.5%",
        aspectRatio: "1 / 1",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 29 29"
        shapeRendering="crispEdges"
        className="h-full w-full object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.1)] transition-all duration-200 group-hover:brightness-125"
      >
        <path
          stroke="#737373"
          className="transition-colors group-hover:stroke-[#a3a3a3]"
          d="M0 0.5h7m3 0h2m1 0h3m3 0h2m1 0h7M0 1.5h1m5 0h1m2 0h3m1 0h4m5 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m1 0h3m1 0h2m1 0h1m2 0h2m2 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h1m2 0h2m1 0h2m1 0h1m2 0h1m1 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h1m1 0h2m3 0h2m2 0h2m1 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h1m1 0h3m4 0h2m1 0h1m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h5m1 0h1m1 0h1M0 8.5h1m1 0h5m3 0h2m4 0h2m4 0h5M3 9.5h2m3 0h1m1 0h1m1 0h4m1 0h8m3 0h1M0 10.5h3m1 0h1m1 0h1m2 0h8m1 0h1m3 0h1m1 0h1M2 11.5h2m1 0h1m2 0h6m1 0h1m2 0h1m1 0h2m1 0h1m1 0h1m1 0h1M1 12.5h1m1 0h1m1 0h3m3 0h1m2 0h2m1 0h1m1 0h1m5 0h2M0 13.5h4m6 0h3m2 0h10m3 0h1M1 14.5h9m1 0h2m5 0h1m2 0h6M0 15.5h1m2 0h1m1 0h1m1 0h1m2 0h1m1 0h1m1 0h1m1 0h1m3 0h1m6 0h1M0 16.5h2m1 0h1m2 0h1m2 0h1m1 0h2m4 0h1m1 0h1m5 0h2M0 17.5h2m1 0h1m1 0h1m1 0h1m1 0h2m2 0h3m3 0h6m1 0h1m1 0h1M0 18.5h1m1 0h1m3 0h1m1 0h3m2 0h6m1 0h1m1 0h3m1 0h1M0 19.5h1m1 0h4m1 0h2m2 0h3m1 0h2m1 0h3m1 0h2m3 0h1M0 20.5h1m2 0h2m1 0h5m1 0h1m1 0h1m2 0h1m1 0h6m1 0h3M8 21.5h2m1 0h2m3 0h1m3 0h1m3 0h5M0 22.5h7m2 0h2m4 0h2m2 0h2m1 0h1m1 0h3M0 23.5h1m5 0h1m1 0h1m5 0h1m1 0h1m1 0h3m3 0h1m2 0h1M0 24.5h1m1 0h3m1 0h1m1 0h2m1 0h1m5 0h2m1 0h5m1 0h2M0 25.5h1m1 0h3m1 0h1m1 0h3m3 0h1m1 0h3m6 0h4M0 26.5h1m1 0h3m1 0h1m1 0h5m2 0h3m1 0h1m1 0h7M0 27.5h1m5 0h1m2 0h1m1 0h3m4 0h1m1 0h1m1 0h3m2 0h1M0 28.5h7m1 0h4m2 0h2m1 0h1m1 0h1m1 0h2m1 0h3"
        />
      </svg>
    </a>
  );
}
