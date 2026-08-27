CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE placement_status AS ENUM (
  'reserved',
  'paid',
  'expired',
  'cancelled',
  'payment_review'
);

CREATE TABLE placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name varchar(80) NOT NULL,
  website_url text NOT NULL,
  creative_url text,
  creative_pathname text,
  creative_fit varchar(10) NOT NULL DEFAULT 'contain',
  mime_type varchar(32),
  x integer NOT NULL,
  y integer NOT NULL,
  width_cells integer NOT NULL,
  height_cells integer NOT NULL,
  pixel_count integer GENERATED ALWAYS AS (width_cells * height_cells * 100) STORED,
  amount_cents integer NOT NULL,
  status placement_status NOT NULL DEFAULT 'reserved',
  requester_hash text NOT NULL,
  reservation_expires_at timestamptz NOT NULL,
  checkout_session_id text,
  payment_id text,
  customer_email text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CONSTRAINT placements_brand_name_length CHECK (char_length(btrim(brand_name)) BETWEEN 1 AND 80),
  CONSTRAINT placements_website_url_length CHECK (char_length(website_url) BETWEEN 8 AND 2048),
  CONSTRAINT placements_creative_fit CHECK (creative_fit IN ('contain', 'cover')),
  CONSTRAINT placements_x_bounds CHECK (x >= 0 AND x < 60),
  CONSTRAINT placements_y_bounds CHECK (y >= 0 AND y < 84),
  CONSTRAINT placements_width_bounds CHECK (width_cells >= 1 AND x + width_cells <= 60),
  CONSTRAINT placements_height_bounds CHECK (height_cells >= 1 AND y + height_cells <= 84),
  CONSTRAINT placements_no_overlap EXCLUDE USING gist (
    int4range(x, x + width_cells, '[)') WITH &&,
    int4range(y, y + height_cells, '[)') WITH &&
  ) WHERE (status IN ('reserved'::placement_status, 'paid'::placement_status))
);

CREATE INDEX placements_status_idx ON placements (status);
CREATE INDEX placements_reservation_expires_at_idx ON placements (reservation_expires_at);
CREATE INDEX placements_requester_created_at_idx ON placements (requester_hash, created_at);
CREATE UNIQUE INDEX placements_checkout_session_unique
  ON placements (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX placements_payment_id_unique
  ON placements (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE TABLE payment_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER placements_set_updated_at
BEFORE UPDATE ON placements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION reserve_placement(
  p_brand_name text,
  p_website_url text,
  p_creative_fit text,
  p_x integer,
  p_y integer,
  p_width_cells integer,
  p_height_cells integer,
  p_requester_hash text,
  p_reservation_expires_at timestamptz
)
RETURNS SETOF placements
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_pixels constant integer := 504000;
  v_tier_size constant integer := 100000;
  v_pixels_sold integer;
  v_tier_index integer;
  v_max_tier integer;
  v_price_per_pixel integer;
  v_amount_cents integer;
  v_remaining integer;
  v_sold integer;
  v_next_threshold integer;
  v_chunk integer;
BEGIN
  IF now() >= timestamptz '2026-09-10 08:00:00+00' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'auction_closed';
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

  SELECT COALESCE(SUM(pixel_count), 0)::integer
  INTO v_pixels_sold
  FROM placements
  WHERE status = 'paid';

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
    reservation_expires_at
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
    p_reservation_expires_at
  )
  RETURNING placements.*;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION USING ERRCODE = '23P01', MESSAGE = 'placement_overlap';
END;
$$;
