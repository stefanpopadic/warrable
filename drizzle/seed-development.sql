-- Dev-only demo placements (~$35.4k total raised, 15 brands). Safe to wipe and re-run.
DELETE FROM placements WHERE is_demo = true;

INSERT INTO placements (
  brand_name,
  website_url,
  creative_url,
  creative_fit,
  mime_type,
  x,
  y,
  width_cells,
  height_cells,
  amount_cents,
  status,
  requester_hash,
  reservation_expires_at,
  is_demo,
  paid_at
)
VALUES
  ('Apple', 'https://apple.com', '/logos/apple.svg', 'contain', 'image/svg+xml', 32, 22, 11, 8, 440000, 'paid', 'demo-seed', now(), true, now()),
  ('Netflix', 'https://netflix.com', '/logos/netflix.svg', 'contain', 'image/svg+xml', 20, 22, 10, 9, 382500, 'paid', 'demo-seed', now(), true, now()),
  ('Figma', 'https://figma.com', '/logos/figma.svg', 'contain', 'image/svg+xml', 47, 0, 10, 12, 300000, 'paid', 'demo-seed', now(), true, now()),
  ('Shopify', 'https://shopify.com', '/logos/shopify.svg', 'contain', 'image/svg+xml', 10, 12, 14, 8, 280000, 'paid', 'demo-seed', now(), true, now()),
  ('Adobe', 'https://adobe.com', '/logos/adobe.svg', 'contain', 'image/svg+xml', 44, 22, 8, 7, 280000, 'paid', 'demo-seed', now(), true, now()),
  ('Linear', 'https://linear.app', '/logos/linear.svg', 'contain', 'image/svg+xml', 27, 0, 10, 10, 250000, 'paid', 'demo-seed', now(), true, now()),
  ('Vercel', 'https://vercel.com', '/logos/vercel.svg', 'contain', 'image/svg+xml', 14, 0, 12, 8, 240000, 'paid', 'demo-seed', now(), true, now()),
  ('Airbnb', 'https://airbnb.com', '/logos/airbnb.svg', 'contain', 'image/svg+xml', 26, 12, 12, 8, 240000, 'paid', 'demo-seed', now(), true, now()),
  ('Spotify', 'https://spotify.com', '/logos/spotify.svg', 'contain', 'image/svg+xml', 10, 22, 8, 12, 240000, 'paid', 'demo-seed', now(), true, now()),
  ('Stripe', 'https://stripe.com', '/logos/stripe.svg', 'contain', 'image/svg+xml', 0, 12, 9, 9, 202500, 'paid', 'demo-seed', now(), true, now()),
  ('Slack', 'https://slack.com', '/logos/slack.svg', 'contain', 'image/svg+xml', 40, 12, 8, 10, 200000, 'paid', 'demo-seed', now(), true, now()),
  ('Notion', 'https://notion.so', '/logos/notion.svg', 'contain', 'image/svg+xml', 38, 0, 8, 8, 160000, 'paid', 'demo-seed', now(), true, now()),
  ('OpenAI', 'https://openai.com', '/logos/openai.svg', 'contain', 'image/svg+xml', 0, 22, 9, 6, 135000, 'paid', 'demo-seed', now(), true, now()),
  ('GitHub', 'https://github.com', '/logos/github.svg', 'contain', 'image/svg+xml', 6, 0, 7, 7, 122500, 'paid', 'demo-seed', now(), true, now()),
  ('Nike', 'https://nike.com', '/logos/nike.svg', 'contain', 'image/svg+xml', 0, 0, 5, 5, 62500, 'paid', 'demo-seed', now(), true, now());
