-- Extending a placement is now an amount, not a hand-drawn rectangle. The buyer
-- says how many cells to add; the board packer decides where everything lands
-- when the payment settles, so a pending extension has no coordinates of its own.

ALTER TABLE placement_extensions
  ADD COLUMN IF NOT EXISTS added_cells integer;

-- Backfill any in-flight rows from the old contains-the-original geometry.
UPDATE placement_extensions e
SET added_cells = GREATEST(
  1,
  (e.width_cells * e.height_cells) - (p.width_cells * p.height_cells)
)
FROM placements p
WHERE p.id = e.placement_id
  AND e.added_cells IS NULL;

UPDATE placement_extensions
SET added_cells = GREATEST(1, COALESCE(width_cells * height_cells, 1))
WHERE added_cells IS NULL;

ALTER TABLE placement_extensions
  ALTER COLUMN added_cells SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'placement_extensions_added_positive'
  ) THEN
    ALTER TABLE placement_extensions
      ADD CONSTRAINT placement_extensions_added_positive CHECK (added_cells >= 1);
  END IF;
END $$;

-- Target geometry is resolved at settle time, so reservations no longer carry one.
ALTER TABLE placement_extensions ALTER COLUMN x DROP NOT NULL;
ALTER TABLE placement_extensions ALTER COLUMN y DROP NOT NULL;
ALTER TABLE placement_extensions ALTER COLUMN width_cells DROP NOT NULL;
ALTER TABLE placement_extensions ALTER COLUMN height_cells DROP NOT NULL;

ALTER TABLE placement_extensions DROP CONSTRAINT IF EXISTS placement_extensions_size;

-- Same reservation function as 0007, minus the pending-extension rect overlap test:
-- extensions now reserve capacity, not coordinates.
CREATE OR REPLACE FUNCTION reserve_placement(
  p_brand_name text,
  p_website_url text,
  p_creative_fit text,
  p_x integer,
  p_y integer,
  p_width_cells integer,
  p_height_cells integer,
  p_requester_hash text,
  p_reservation_expires_at timestamptz,
  p_customer_email text DEFAULT NULL
)
RETURNS SETOF placements
LANGUAGE plpgsql
AS $$
DECLARE
  v_world_cols constant integer := 80;
  v_world_rows constant integer := 112;
  v_total_pixels constant integer := 896000;
  v_tier_size constant integer := 100000;
  v_pixels_sold integer;
  v_raised_cents bigint;
  v_view_cols integer;
  v_view_rows integer;
  v_view_x integer;
  v_view_y integer;
  v_tier_index integer;
  v_max_tier integer;
  v_price_per_pixel integer;
  v_amount_cents integer;
  v_remaining integer;
  v_sold integer;
  v_next_threshold integer;
  v_chunk integer;
  v_email text;
BEGIN
  IF now() >= timestamptz '2026-09-10 08:00:00+00' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'auction_closed';
  END IF;

  v_email := NULLIF(lower(btrim(COALESCE(p_customer_email, ''))), '');
  IF v_email IS NULL OR char_length(v_email) < 3 OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'email_required';
  END IF;

  IF (
    SELECT count(*)
    FROM placements
    WHERE requester_hash = p_requester_hash
      AND created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'rate_limited';
  END IF;

  UPDATE placements
  SET status = 'expired'
  WHERE status = 'reserved'
    AND reservation_expires_at <= now();

  UPDATE placement_extensions
  SET status = 'expired'
  WHERE status = 'reserved'
    AND expires_at <= now();

  SELECT
    COALESCE(SUM(pixel_count), 0)::integer,
    COALESCE(SUM(amount_cents), 0)::bigint
  INTO v_pixels_sold, v_raised_cents
  FROM placements
  WHERE status = 'paid';

  v_view_cols := CASE
    WHEN v_raised_cents >= 25000000 THEN 70
    WHEN v_raised_cents >= 10000000 THEN 60
    WHEN v_raised_cents >= 5000000 THEN 50
    WHEN v_raised_cents >= 2500000 THEN 40
    WHEN v_raised_cents >= 1000000 THEN 30
    ELSE 20
  END;
  v_view_rows := (v_view_cols * 7) / 5;
  v_view_x := (v_world_cols - v_view_cols) / 2;
  v_view_y := (v_world_rows - v_view_rows) / 2;

  IF p_x < v_view_x
    OR p_y < v_view_y
    OR p_x + p_width_cells > v_view_x + v_view_cols
    OR p_y + p_height_cells > v_view_y + v_view_rows
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'outside_viewport';
  END IF;

  v_max_tier := GREATEST(0, CEIL(v_total_pixels::numeric / v_tier_size::numeric)::integer - 1);
  v_remaining := p_width_cells * p_height_cells * 100;
  v_sold := v_pixels_sold;
  v_amount_cents := 0;

  WHILE v_remaining > 0 LOOP
    v_tier_index := LEAST(GREATEST(v_sold / v_tier_size, 0), v_max_tier);
    v_price_per_pixel := 25 * POWER(2, v_tier_index)::integer;
    v_next_threshold := LEAST((v_tier_index + 1) * v_tier_size, v_total_pixels);
    v_chunk := LEAST(v_remaining, GREATEST(v_next_threshold - v_sold, 0));

    IF v_chunk <= 0 THEN
      EXIT;
    END IF;

    v_amount_cents := v_amount_cents + (v_chunk * v_price_per_pixel);
    v_remaining := v_remaining - v_chunk;
    v_sold := v_sold + v_chunk;
  END LOOP;

  RETURN QUERY
  INSERT INTO placements (
    brand_name,
    website_url,
    creative_fit,
    x,
    y,
    width_cells,
    height_cells,
    amount_cents,
    requester_hash,
    reservation_expires_at,
    customer_email
  )
  VALUES (
    btrim(p_brand_name),
    p_website_url,
    p_creative_fit,
    p_x,
    p_y,
    p_width_cells,
    p_height_cells,
    v_amount_cents,
    p_requester_hash,
    p_reservation_expires_at,
    v_email
  )
  RETURNING placements.*;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION USING ERRCODE = '23P01', MESSAGE = 'placement_overlap';
END;
$$;
