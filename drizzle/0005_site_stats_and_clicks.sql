ALTER TABLE placements
  ADD COLUMN IF NOT EXISTS link_clicks integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS site_stats (
  id text PRIMARY KEY,
  visitor_count bigint NOT NULL DEFAULT 0,
  online_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_stats (id, visitor_count, online_count)
VALUES ('default', 0, 0)
ON CONFLICT (id) DO NOTHING;
