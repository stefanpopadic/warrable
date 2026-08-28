"use client";

import { useEffect, useState } from "react";

type SiteStats = {
  onlineCount: number;
  visitorCount: number;
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

  return (
    <div
      className="hidden min-w-0 items-center gap-2 rounded-full border border-border/80 bg-secondary/40 px-3 py-1.5 font-condensed text-[11px] leading-none tracking-wide sm:flex sm:gap-2.5 sm:px-4 sm:text-xs"
      aria-label="Live site stats"
    >
      <span className="inline-flex items-center gap-1.5 text-emerald-400">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
        <span>{online.toLocaleString()} online</span>
      </span>
      <span className="text-muted-foreground" aria-hidden="true">·</span>
      <span className="truncate text-muted-foreground">
        {visitors.toLocaleString()} visitors since launch
      </span>
      <span className="text-muted-foreground" aria-hidden="true">·</span>
      <a
        href="https://datafa.st"
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-foreground/80 transition-colors hover:text-foreground"
      >
        see stats →
      </a>
    </div>
  );
}
