-- Dev-only demo placements. Safe to wipe and re-run after pricing changes.
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
  ('Vercel', 'https://vercel.com', '/logos/vercel.svg', 'contain', 'image/svg+xml', 3, 4, 14, 10, 350000, 'paid', 'demo-seed', now(), true, now()),
  ('Linear', 'https://linear.app', '/logos/linear.svg', 'contain', 'image/svg+xml', 20, 3, 10, 14, 350000, 'paid', 'demo-seed', now(), true, now()),
  ('Notion', 'https://notion.so', '/logos/notion.svg', 'contain', 'image/svg+xml', 34, 5, 18, 8, 360000, 'paid', 'demo-seed', now(), true, now()),
  ('Figma', 'https://figma.com', '/logos/figma.svg', 'contain', 'image/svg+xml', 5, 18, 11, 15, 412500, 'paid', 'demo-seed', now(), true, now()),
  ('Webflow', 'https://webflow.com', '/logos/webflow.svg', 'contain', 'image/svg+xml', 19, 20, 17, 9, 382500, 'paid', 'demo-seed', now(), true, now()),
  ('Stripe', 'https://stripe.com', '/logos/stripe.svg', 'contain', 'image/svg+xml', 40, 17, 13, 13, 422500, 'paid', 'demo-seed', now(), true, now()),
  ('Shopify', 'https://shopify.com', '/logos/shopify.svg', 'contain', 'image/svg+xml', 3, 38, 19, 10, 727500, 'paid', 'demo-seed', now(), true, now()),
  ('Slack', 'https://slack.com', '/logos/slack.svg', 'contain', 'image/svg+xml', 26, 35, 9, 16, 720000, 'paid', 'demo-seed', now(), true, now()),
  ('Dropbox', 'https://dropbox.com', '/logos/dropbox.svg', 'contain', 'image/svg+xml', 39, 37, 16, 9, 720000, 'paid', 'demo-seed', now(), true, now()),
  ('Airbnb', 'https://airbnb.com', '/logos/airbnb.svg', 'contain', 'image/svg+xml', 15, 55, 28, 10, 1400000, 'paid', 'demo-seed', now(), true, now()),
  ('Nike', 'https://nike.com', '/logos/nike.svg', 'contain', 'image/svg+xml', 0, 0, 3, 3, 45000, 'paid', 'demo-seed', now(), true, now()),
  ('Adidas', 'https://adidas.com', '/logos/adidas.svg', 'contain', 'image/svg+xml', 54, 0, 6, 12, 360000, 'paid', 'demo-seed', now(), true, now()),
  ('Spotify', 'https://spotify.com', '/logos/spotify.svg', 'contain', 'image/svg+xml', 0, 15, 4, 18, 360000, 'paid', 'demo-seed', now(), true, now()),
  ('GitHub', 'https://github.com', '/logos/github.svg', 'contain', 'image/svg+xml', 17, 30, 8, 8, 320000, 'paid', 'demo-seed', now(), true, now()),
  ('OpenAI', 'https://openai.com', '/logos/openai.svg', 'contain', 'image/svg+xml', 36, 30, 10, 6, 300000, 'paid', 'demo-seed', now(), true, now()),
  ('Adobe', 'https://adobe.com', '/logos/adobe.svg', 'contain', 'image/svg+xml', 47, 31, 11, 5, 280000, 'paid', 'demo-seed', now(), true, now()),
  ('Netflix', 'https://netflix.com', '/logos/netflix.svg', 'contain', 'image/svg+xml', 0, 50, 12, 8, 960000, 'paid', 'demo-seed', now(), true, now()),
  ('YouTube', 'https://youtube.com', '/logos/youtube.svg', 'contain', 'image/svg+xml', 45, 50, 12, 10, 1200000, 'paid', 'demo-seed', now(), true, now()),
  ('Apple', 'https://apple.com', '/logos/apple.svg', 'contain', 'image/svg+xml', 0, 65, 16, 10, 1600000, 'paid', 'demo-seed', now(), true, now()),
  ('Amazon', 'https://amazon.com', '/logos/amazon.svg', 'contain', 'image/svg+xml', 44, 63, 16, 12, 1920000, 'paid', 'demo-seed', now(), true, now());
