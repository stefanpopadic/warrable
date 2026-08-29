"use client";

import { useEffect, useState } from "react";

type SiteStats = {
  onlineCount: number;
  visitorCount: number;
  clickCount: number;
};

const VIEW_KEY = "mdt-site-view-recorded";

export function SiteStatsPill() {
  const [stats, setStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/site/stats", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as SiteStats;
        if (active) setStats(body);
      } catch {
        // Stats are optional UI polish.
      }
    };

    const recordView = async () => {
      if (sessionStorage.getItem(VIEW_KEY)) return;
      try {
        const response = await fetch("/api/site/stats/view", { method: "POST" });
        if (!response.ok) return;
        sessionStorage.setItem(VIEW_KEY, "1");
        const body = (await response.json()) as SiteStats;
        if (active) setStats(body);
      } catch {
        // Ignore duplicate view recording failures.
      }
    };

    void recordView().then(load);
    const interval = window.setInterval(load, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const online = stats?.onlineCount ?? 0;
  const visitors = stats?.visitorCount ?? 0;
  const clicks = stats?.clickCount ?? 0;

  return (
    <div
      className="hidden min-w-0 items-stretch border border-border bg-background font-condensed text-[10px] uppercase leading-none tracking-[0.14em] sm:flex"
      aria-label="Live site stats"
    >
      <span className="inline-flex items-center gap-1.5 border-r border-border px-3 py-2 text-muted-foreground">
        <span className="h-1.5 w-1.5 shrink-0 bg-emerald-400" aria-hidden="true" />
        <strong className="font-normal tabular-nums text-foreground">
          {online.toLocaleString()}
        </strong>
        live
      </span>
      <span className="inline-flex items-center gap-1.5 border-r border-border px-3 py-2 text-muted-foreground">
        <strong className="font-normal tabular-nums text-foreground">
          {visitors.toLocaleString()}
        </strong>
        visitors
      </span>
      <span className="inline-flex items-center gap-1.5 px-3 py-2 text-muted-foreground">
        <strong className="font-normal tabular-nums text-foreground">
          {clicks.toLocaleString()}
        </strong>
        clicks
      </span>
    </div>
  );
}
