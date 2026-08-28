-- Store buyer email at reservation time, and support paid placement extensions
-- (grow same placement, charge only the delta) without overlapping the paid row.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'placement_extension_status') THEN
    CREATE TYPE placement_extension_status AS ENUM (
      'reserved',
      'paid',
      'expired',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS placement_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES placements(id),
  email text NOT NULL,
  x integer NOT NULL,
  y integer NOT NULL,
  width_cells integer NOT NULL,
  height_cells integer NOT NULL,
  amount_cents integer NOT NULL,
  new_amount_cents integer NOT NULL,
  status placement_extension_status NOT NULL DEFAULT 'reserved',
  requester_hash text NOT NULL,
  checkout_session_id text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CONSTRAINT placement_extensions_email_length CHECK (char_length(email) BETWEEN 3 AND 320),
  CONSTRAINT placement_extensions_amount_positive CHECK (amount_cents > 0 AND new_amount_cents > 0),
  CONSTRAINT placement_extensions_size CHECK (width_cells >= 1 AND height_cells >= 1)
);

CREATE INDEX IF NOT EXISTS placement_extensions_placement_idx
  ON placement_extensions (placement_id);
CREATE INDEX IF NOT EXISTS placement_extensions_status_expires_idx
  ON placement_extensions (status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS placement_extensions_checkout_session_unique
  ON placement_extensions (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS placement_extensions_one_active_per_placement
  ON placement_extensions (placement_id)
  WHERE status = 'reserved';

DROP FUNCTION IF EXISTS reserve_placement(text, text, text, integer, integer, integer, integer, text, timestamptz);

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

  -- Pending extensions occupy their target rect so new buys cannot steal that space.
  IF EXISTS (
    SELECT 1
    FROM placement_extensions e
    WHERE e.status = 'reserved'
      AND e.expires_at > now()
      AND int4range(e.x, e.x + e.width_cells, '[)') && int4range(p_x, p_x + p_width_cells, '[)')
      AND int4range(e.y, e.y + e.height_cells, '[)') && int4range(p_y, p_y + p_height_cells, '[)')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23P01', MESSAGE = 'placement_overlap';
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
